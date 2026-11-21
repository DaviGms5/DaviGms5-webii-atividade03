// ADICIONADO: módulo V2 de matérias; reutiliza contrato estável sem editar a V1.
import express from "express";
import stableSubjectRoutes from "../../v1/routes/subjectRoutes.js";
// ADICIONADO (aula 11): autenticação e papéis aplicados antes de delegar às rotas estáveis.
import authenticate from "../../../middlewares/auth.js";
import authorize, { isAdmin } from "../../../middlewares/authorize.js";

const router = express.Router();

// ADICIONADO (aula 11): leitura continua pública; escrever exige token de PROFESSOR ou ADMIN.
router.post("/", authenticate, authorize("PROFESSOR", "ADMIN"));
router.patch("/:id", authenticate, authorize("PROFESSOR", "ADMIN"));
// ADICIONADO (aula 11): remover é uma ação crítica, reservada ao ADMIN.
router.delete("/:id", authenticate, isAdmin);

// ADICIONADO: compõe validação, controller e service existentes de Subject.
router.use("/", stableSubjectRoutes);

export default router;
