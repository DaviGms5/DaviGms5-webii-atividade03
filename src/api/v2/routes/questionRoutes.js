// ADICIONADO: módulo V2 de questões; não altera arquivos ou regras da V1.
import express from "express";
import stableQuestionRoutes from "../../v1/routes/questionRoutes.js";
// ADICIONADO (aula 11): autenticação e papéis aplicados antes de delegar às rotas estáveis.
import authenticate from "../../../middlewares/auth.js";
import authorize, { isAdmin } from "../../../middlewares/authorize.js";

const router = express.Router();

// ADICIONADO (aula 11): leitura continua pública; escrever exige token de PROFESSOR ou ADMIN.
router.post("/", authenticate, authorize("PROFESSOR", "ADMIN"));
router.patch("/:id", authenticate, authorize("PROFESSOR", "ADMIN"));
// ADICIONADO (aula 11): remover é uma ação crítica, reservada ao ADMIN.
router.delete("/:id", authenticate, isAdmin);

// ADICIONADO: reaproveita integralmente o contrato estável de Question.
router.use("/", stableQuestionRoutes);

export default router;
