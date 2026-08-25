//src/app.js
import express from "express";
import prisma from "./config/database.js";

const app = express();

app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "OK",
      message: "API do Gerador de Provas",
      timestamp: new Date().toISOString(),
      services: {
        api: "OK",
        database: { status: "OK" },
      },
    });
  } catch (error) {
    console.error("Erro na verificação do banco:", error);

    res.status(503).json({
      status: "DEGRADED",
      message: "API do Gerador de Provas",
      services: {
        api: "OK",
        database: { status: "ERROR" },
      },
    });
  }
});

app.get("/users", async (req, res) => {
  try {
    const usuarios = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        foto: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    });

    res.status(200).json({
      success: true,
      data: usuarios,
      total: usuarios.length,
    });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);

    res.status(500).json({
      success: false,
      message: "Erro ao buscar usuários",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Rota " + req.method + " " + req.originalUrl + " não encontrada",
  });
});

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// 1. GET /subjects
app.get('/subjects', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        // Inclui o professor responsável selecionando apenas os dados públicos
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
            // NUNCA inclua a senha/password aqui
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: subjects,
      total: subjects.length
    });
  } catch (error) {
    // Retorna status 500 em caso de erro sem expor detalhes do erro do banco
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// 2. GET /questions
app.get('/questions', async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        // Inclui a matéria
        subject: true,
        // Inclui o autor selecionando apenas os dados públicos
        author: {
          select: {
            id: true,
            name: true,
            email: true
            // NUNCA inclua a senha/password aqui
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: questions,
      total: questions.length
    });
  } catch (error) {
    // Retorna status 500 sem expor detalhes internos
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = app;
export default app;