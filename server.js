const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const app = express();
const port = 3000;

// Configuração do CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Pasta onde os arquivos serão salvos
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nome do arquivo
  },
});

const upload = multer({ storage });

// Middleware para permitir o uso de JSON no corpo das requisições
app.use(express.json());

// Rota de exemplo
app.get("/", (req, res) => {
  res.send("Backend rodando!");
});

// Rota para receber dados via POST
app.post("/publications", upload.single("image"), (req, res) => {
  try {
    const { owner, title, description } = req.body;
    const image = req.file ? req.file.path : null; // Caminho do arquivo de imagem

    console.log("Dados recebidos:", { titulo, description, image });
    res.status(200).json({ message: "Publicação recebida com sucesso!" });
  } catch (error) {
    console.error("Erro ao processar a publicação:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

app.post("/login", (req, res) => {
  console.log("Requisição de login recebida!");
  console.log("Dados recebidos:", req.body);
  res.status(200).json({ message: "Login realizado com sucesso!" });
});

app.post("/signup", (req, res) => {
  console.log("Requisição de cadastro recebida!");
  console.log("Dados recebidos:", req.body);
  res.status(200).json({ message: "Cadast\ro realizado com sucesso!" });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
