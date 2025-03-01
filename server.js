const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = express();
const port = 3000;

const uri =
  "mongodb+srv://myAtlasDBUser:135790@myatlasclusteredu.ufhaxua.mongodb.net/ByteLandDatabase?retryWrites=true&w=majority&appName=myAtlasClusterEDU";

//Esquema do usuário
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
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
  comments: [
    {
      owner: String,
      comment: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
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

//Configuração do CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Verificar senha
async function verifyPassword(password, hash) {
  const match = await bcrypt.compare(password, hash);
  return match;
}

//Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Pasta onde os arquivos serão salvos
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nome do arquivo
  },
});

const upload = multer({ storage });

//Configura o diretório de uploads para servir arquivos estáticos
const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

//Middleware para permitir o uso de JSON no corpo das requisições
app.use(express.json());

//Rota de exemplo
app.get("/", (req, res) => {
  res.send("Backend rodando!");
});

//Rota para deletar comentários de publicações
app.post("/deleteComment", async (req, res) => {
  try {
    console.log("Estou deletando");
    const { publicationId, commentId } = req.body.data;

    const publication = await Publication.findOne({ _id: publicationId });

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    const commentIndex = publication.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );
    console.log(commentIndex);

    if (commentIndex !== -1) {
      publication.comments.splice(commentIndex, 1);

      await publication.save();
      res.status(200).json({ message: "Comentário deletado com sucesso" });
    }
  } catch (error) {
    console.log(error);
  }
});

//Rota para obter todas os comentários de uma publicação
app.post("/getComments", async (req, res) => {
  const { id } = req.body.data;
  try {
    const publication = await Publication.findOne({ _id: id });

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    res.status(200).json({ comments: publication.comments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Rota para adicionar comentários em uma publicação
app.post("/addComment", async (req, res) => {
  try {
    const { user, id, comment } = req.body.data;

    const publication = await Publication.findOne({ _id: id });

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    const newComment = {
      owner: user,
      comment: comment,
      createdAt: Date.now(),
    };

    if (!user || !comment) {
      return res.status(404).json({ message: "Comentário não pode ser vazio" });
    }

    publication.comments.push(newComment);

    await publication.save();

    res.status(200).json({ message: "Comentário adicionado com sucesso" });
  } catch (error) {
    console.log(error);
  }
});
//Rota para receber as publicações
app.post("/publications", upload.single("image"), async (req, res) => {
  try {
    const { owner, title, description } = req.body;
    const image = req.file ? req.file.path : null; // Caminho do arquivo de imagem

    const newPublication = new Publication({
      owner: owner,
      title: title,
      description: description,
      image: image,
      comments: [],
    });

    await newPublication.save();

    console.log("Dados recebidos:", { title, description, image });
    res.status(200).json({ message: "Publicação recebida com sucesso!" });
  } catch (error) {
    console.error("Erro ao processar a publicação:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

//Rota para deletar publicação
app.delete("/deletePublication", async (req, res) => {
  try {
    const { owner, id } = req.body;
    const publication = await Publication.findOneAndDelete({ _id: id });

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    // await Publication.deleteOne({ _id: id });
    res.status(200).json({ message: "Publicação deletada com sucesso" });
  } catch (error) {
    res.status(500).json({ error: error });
  }
});

//Rota para buscar publicações
app.get("/getPublications", async (req, res) => {
  try {
    const publications = await Publication.find();
    res.json(publications);
  } catch (error) {
    console.error("Erro ao buscar publicações:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

//Rota para editar uma publicação
app.put("/editPublication", upload.single("image"), async (req, res) => {
  console.log(req.body);
  try {
    const { owner, id, title, description } = req.body;
    let imagePath = null;

    // Verifica se um arquivo de imagem foi enviado
    if (req.file) {
      // Salva o caminho do arquivo no banco de dados
      imagePath = req.file.path;
    }

    // Encontra a publicação no banco de dados
    const publication = await Publication.findOne({ _id: id });

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    // Atualiza os campos da publicação
    if (title.replaceAll(" ", "") != "" && title != null) {
      publication.title = title;
    } else {
      return res.status(404).json({ message: "Título não pode ser vazio" });
    }

    if (description.replaceAll(" ", "") != "" && description != null) {
      publication.description = description;
    } else {
      return res.status(404).json({ message: "Descrição não pode ser vazia" });
    }

    // Se uma nova imagem foi fornecida, atualiza o campo de imagem
    if (imagePath) {
      publication.image = imagePath;
    } else if (imagePath == null) {
      publication.image = null;
    }

    // Salva as alterações no banco de dados
    await publication.save();

    res.status(200).json({
      message: "Publicação editada com sucesso",
      publication: publication,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Rota de Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Esse usuário não existe." });
    }

    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    const userWithoutPassword = { ...user.toObject() };
    delete userWithoutPassword.password;

    res.status(200).json({
      message: "Login realizado com sucesso!",
      user: userWithoutPassword,
    });
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: user,
      email: email,
      password: hashedPassword,
    });

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

//Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
