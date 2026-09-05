import prisma from '../config/database.js';

export const createSubject = async (req, res) => {
  try {
    const { nome, professorId } = req.body;

    // 1. Validação de campos obrigatórios
    if (!nome || professorId === undefined) {
      return res.status(400).json({ message: 'Nome e professorId são obrigatórios.' });
    }

    // 2. Validação de ID como inteiro positivo
    const parsedProfessorId = Number(professorId);
    if (!Number.isInteger(parsedProfessorId) || parsedProfessorId <= 0) {
      return res.status(400).json({ message: 'O professorId deve ser um número inteiro positivo.' });
    }

    // 3. Confirmar que o professor existe no banco
    const professorExists = await prisma.user.findUnique({
      where: { id: parsedProfessorId }
    });

    if (!professorExists) {
      return res.status(404).json({ message: 'Professor informado não existe.' });
    }

    // Criação do registro
    const subject = await prisma.subject.create({
      data: {
        nome,
        professorId: parsedProfessorId
      },
      // Select para retornar apenas dados públicos das relações
      select: {
        id: true,
        nome: true,
        ativa: true,
        createdAt: true,
        professor: {
          select: {
            id: true,
            nome: true,
            email: true
          }
        }
      }
    });

    return res.status(201).json(subject);
  } catch (error) {
    // Nunca devolver detalhes internos do erro
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

export const getSubjects = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      select: {
        id: true,
        nome: true,
        ativa: true,
        createdAt: true,
        professor: {
          select: {
            id: true,
            nome: true,
            email: true
          }
        }
      }
    });

    return res.status(200).json(subjects);
  } catch (error) {
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

export const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = Number(id);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ message: 'O ID deve ser um número inteiro positivo.' });
    }

    const subject = await prisma.subject.findUnique({
      where: { id: parsedId },
      select: {
        id: true,
        nome: true,
        ativa: true,
        createdAt: true,
        professor: {
          select: {
            id: true,
            nome: true,
            email: true
          }
        }
      }
    });

    if (!subject) {
      return res.status(404).json({ message: 'Matéria não encontrada.' });
    }

    return res.status(200).json(subject);
  } catch (error) {
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};