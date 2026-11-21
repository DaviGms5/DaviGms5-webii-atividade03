import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { parse } from "yaml";

/**
 * Lê um arquivo de configuração da raiz do projeto como texto.
 * @param {string} path - Caminho relativo à raiz do projeto.
 * @returns {Promise<string>} Conteúdo do arquivo.
 */
function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

/**
 * Lê o package.json como objeto.
 * @returns {Promise<Record<string, any>>} Conteúdo do package.json.
 */
async function readPackageJson() {
  return JSON.parse(await readProjectFile("package.json"));
}

/**
 * Lê o workflow de CI como objeto: os critérios avaliam a estrutura, e não o texto.
 * @returns {Promise<Record<string, any>>} Workflow interpretado pelo parser YAML.
 */
async function readWorkflow() {
  return parse(await readProjectFile(".github/workflows/ci.yml"));
}

/**
 * Lista os comandos `run` de um job, na ordem em que o runner os executa.
 * @param {Record<string, any>} job - Job do workflow.
 * @returns {string[]} Comandos dos steps que executam comandos.
 */
function runCommands(job) {
  return job.steps.filter((step) => step.run).map((step) => step.run.trim());
}

/**
 * Procura o step que usa uma action (por exemplo, `actions/checkout@v7`).
 * @param {Record<string, any>} job - Job do workflow.
 * @param {string} action - Nome da action, sem a versão.
 * @returns {Record<string, any> | undefined} Step encontrado.
 */
function findActionStep(job, action) {
  return job.steps.find((step) => step.uses?.startsWith(`${action}@`));
}

/**
 * Reserva uma porta TCP livre para iniciar o servidor sem colidir com outro processo.
 * @returns {Promise<number>} Número da porta.
 */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

describe("Prática - Deploy e CI", () => {
  it("package.json define os scripts de produção e a versão do Node", async () => {
    const pkg = await readPackageJson();

    expect(pkg.scripts).toMatchObject({
      start: "node src/server.js",
      "db:generate": "prisma generate",
      "db:migrate": "prisma migrate deploy",
      "db:migrate:dev": "prisma migrate dev",
      "db:studio": "prisma studio",
      "vercel-build": "npm run db:generate && npm run db:migrate",
    });
    // O script de desenvolvimento continua com tsx e recarga automática.
    expect(pkg.scripts.dev).toContain("tsx src/server.js");
    expect(pkg.engines).toEqual({ node: "26.x" });
  });

  it("vercel.json usa as propriedades atuais da Vercel", async () => {
    const config = JSON.parse(await readProjectFile("vercel.json"));

    expect(config).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      buildCommand: "npm run vercel-build",
      regions: ["gru1"],
    });
  });

  it("npm start inicia a API com Node puro e encerra com SIGTERM", async () => {
    const pkg = await readPackageJson();
    const [command, ...args] = pkg.scripts.start.split(" ");
    expect(command).toBe("node");

    const port = await freePort();
    const child = spawn(process.execPath, args, {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = new Promise((resolve) =>
      child.once("exit", (code) => resolve(code)),
    );

    try {
      // Espera a mensagem de inicialização de src/server.js.
      await new Promise((resolve, reject) => {
        let output = "";
        const timer = setTimeout(
          () => reject(new Error(`Servidor não iniciou: ${output}`)),
          15000,
        );
        child.stdout.on("data", (chunk) => {
          output += chunk;
          if (output.includes(`Servidor rodando na porta ${port}`)) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.stderr.on("data", (chunk) => {
          output += chunk;
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Processo terminou com ${code}: ${output}`));
        });
      });

      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.status).toBe("OK");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    } finally {
      child.kill("SIGTERM");
    }

    // O shutdown da aula 05 fecha o servidor e o Prisma e sai com código 0.
    expect(await exited).toBe(0);
  }, 30000);

  it("o workflow de CI roda os testes em pull requests e na main", async () => {
    const workflow = await readWorkflow();

    expect(workflow.on.pull_request.branches).toEqual(["main"]);
    expect(workflow.on.push.branches).toEqual(["main"]);
    expect(workflow.permissions).toEqual({ contents: "read" });

    const test = workflow.jobs.test;
    expect(test["runs-on"]).toBe("ubuntu-latest");
    expect(findActionStep(test, "actions/checkout").uses).toBe(
      "actions/checkout@v7",
    );
    const setupNode = findActionStep(test, "actions/setup-node");
    expect(setupNode.uses).toBe("actions/setup-node@v7");
    expect(setupNode.with).toEqual({ "node-version": 26, cache: "npm" });
    const commands = runCommands(test);
    expect(commands.slice(0, 3)).toEqual([
      "npm ci",
      "npm run db:generate",
      "npm run db:migrate",
    ]);
    // O último step executa testes: test:pratica nesta aula ou a suíte completa.
    expect(commands.slice(3)).toHaveLength(1);
    expect(["npm run test:pratica", "npm test"]).toContain(commands[3]);
  });

  it("o workflow lê o banco de testes de um secret, sem credenciais no arquivo", async () => {
    const source = await readProjectFile(".github/workflows/ci.yml");
    const { jobs } = parse(source);

    expect(jobs.test.env).toEqual({
      DATABASE_URL: "${{ secrets.TEST_DATABASE_URL }}",
      TEST_DATABASE_URL: "${{ secrets.TEST_DATABASE_URL }}",
    });
    expect(source).not.toMatch(/postgres(ql)?:\/\//);
    expect(source).not.toContain("JWT_SECRET");
  });
});

describe("Atividade - Job de qualidade no CI", () => {
  it("o job quality executa lint, formatação e validação do schema", async () => {
    const { jobs } = await readWorkflow();
    const quality = jobs.quality;

    expect(quality, "job quality ausente no workflow").toBeDefined();
    expect(quality["runs-on"]).toBe("ubuntu-latest");
    expect(findActionStep(quality, "actions/checkout").uses).toBe(
      "actions/checkout@v7",
    );
    const setupNode = findActionStep(quality, "actions/setup-node");
    expect(setupNode.uses).toBe("actions/setup-node@v7");
    expect(setupNode.with).toEqual({ "node-version": 26, cache: "npm" });
    expect(runCommands(quality)).toEqual([
      "npm ci",
      "npm run lint",
      "npm run format:check",
      "npx prisma validate",
    ]);
  });

  it("o job test só executa depois que o job quality passa", async () => {
    const { jobs } = await readWorkflow();

    expect(jobs.test.needs).toBe("quality");
  });

  it("o job test executa a suíte completa, com os critérios da atividade", async () => {
    const { jobs } = await readWorkflow();

    expect(runCommands(jobs.test).at(-1)).toBe("npm test");
  });

  it("o job quality não recebe o secret do banco", async () => {
    const { jobs } = await readWorkflow();

    expect(jobs.quality, "job quality ausente no workflow").toBeDefined();
    expect(JSON.stringify(jobs.quality)).not.toContain("secrets.");
  });
});
