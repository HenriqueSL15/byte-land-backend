const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const app = express();
const port = 3000;

const uri =
  "mongodb+srv://myAtlasDBUser:135790@myatlasclusteredu.ufhaxua.mongodb.net/ByteLandDatabase?retryWrites=true&w=majority&appName=myAtlasClusterEDU";

//Esquema do usuário
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  image: {
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/711/711769.png",
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

//Modelo do usuário
const User = mongoose.model("User", userSchema);

//Esquema da publicação
const publicationSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String },
  createdAt: { type: Date, default: Date.now },
});

//Modelo da pulicação
const Publication = mongoose.model("Publication", publicationSchema);

//Configuração Mongoose
mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Conexão com o banco de dados efetuada com sucesso!");
  })
  .catch((err) => {
    console.error("Erro na conexão com o banco de dados:", err);
  });

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

// Configura o diretório de uploads para servir arquivos estáticos
const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

// Middleware para permitir o uso de JSON no corpo das requisições
app.use(express.json());

// Rota de exemplo
app.get("/", (req, res) => {
  res.send("Backend rodando!");
});

app.delete("/deletePublication", async (req, res) => {
  try {
    const { owner, id } = req.body;
    const publication = await Publication.findOne({ _id: id });
    console.log(publication);
    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    await Publication.deleteOne({ _id: id });
    res.status(200).json({ message: "Publicação deletada com sucesso" });
  } catch (error) {
    res.status(500).json({ error: error });
  }
});

// Rota para receber as publicações
app.post("/publications", upload.single("image"), async (req, res) => {
  try {
    const { owner, title, description } = req.body;
    const image = req.file ? req.file.path : null; // Caminho do arquivo de imagem

    const newPublication = new Publication({
      owner: owner,
      title: title,
      description: description,
      image: image,
    });

    await newPublication.save();

    console.log("Dados recebidos:", { title, description, image });
    res.status(200).json({ message: "Publicação recebida com sucesso!" });
  } catch (error) {
    console.error("Erro ao processar a publicação:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// Rota para buscar publicações
app.get("/getPublications", async (req, res) => {
  try {
    const publications = await Publication.find();
    res.json(publications);
  } catch (error) {
    console.error("Erro ao buscar publicações:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

//Rota de Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email, password: password });

    if (!user) {
      return res
        .status(404)
        .json({ message: "O email ou a senha estão incorretos!" });
    }

    res
      .status(200)
      .json({ message: "Login realizado com sucesso!", user: user });
  } catch (error) {
    console.error("Erro ao processar o login:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

//Rota de cadastro
app.post("/signup", async (req, res) => {
  //Criação do perfil no banco de dados
  try {
    const { user, email, password } = req.body;
    const newUser = new User({
      name: user,
      email: email,
      password: password,
    });

    const emailExists = await User.findOne({ email: email });
    const userExists = await User.findOne({ name: user });
    if (emailExists && userExists) {
      return res.json({
        message: "Este nome de usuário e e-mail já estão em uso.",
      });
    } else if (emailExists && !userExists) {
      return res.json({ message: "Esse e-mail já está em uso." });
    } else if (!emailExists && userExists) {
      return res.json({ message: "Esse nome de usuário já está em uso." });
    }

    await newUser.save();
    res
      .status(200)
      .json({ message: "Usuário criado com sucesso!", user: newUser });
  } catch (error) {
    if (error.code == 11000) {
      res.status(409).json({
        message:
          "Alguma informação enviada já existe em outro usuário já existe!",
      });
    } else {
      res.status(500).json({ message: "Erro interno do servidor:", error });
    }
  }
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
