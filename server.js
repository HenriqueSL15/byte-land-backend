const express = require("express");
require("express-async-errors");
const { body, param, query, validationResult } = require("express-validator");
const cors = require("cors");
const multer = require("multer");

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const User = require("./models/User.js");
const Publication = require("./models/Publication.js");
const Message = require("./models/Message.js");
const Conversation = require("./models/Conversation.js");

require("dotenv").config();
const app = express();
const port = 3000;

// String de conexão com o MongoDB Atlas (substitua com suas credenciais)
const uri = process.env.MONGODB_URI;

// Conexão com o MongoDB Atlas
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

// Configuração do CORS para permitir comunicação com o frontend
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://byte-land.netlify.app"
        : "http://localhost:5173", // Permite apenas este domínio
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Métodos permitidos
    allowedHeaders: ["Content-Type", "Authorization"], // Cabeçalhos permitidos
  })
);

// Função para verificar senha com bcrypt
async function verifyPassword(password, hash) {
  const match = await bcrypt.compare(password, hash);
  return match;
}

// Configuarar Cloudinary com suas credenciais
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Apenas imagens são permitidas!"), false);
  }
};

// Configuração do Multer para upload de arquivos
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "byte-land",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
  },
});

const upload = multer({ storage, fileFilter });

// Permite o uso de JSON nas requisições
app.use(express.json());

// Rota de verificação do servidor
app.get("/", (req, res) => {
  res.send("Backend rodando!");
});

app.get(
  "/users/:userId/notifications",
  [param("userId").isMongoId().withMessage("ID de usuário inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    const user = await User.findById(userId).populate("notifications.owner");

    return res.status(200).json({ notifications: user.notifications });
  }
);

app.post(
  "/users/:userId/notifications",
  [
    param("userId").isMongoId().withMessage("ID de usuário inválido"),
    body("message").notEmpty().withMessage("Mensagem é obrigatória"),
    body("owner").isMongoId().withMessage("ID de proprietário inválido"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { message, owner } = req.body;

    const user = await User.findById(userId).populate("notifications.owner");

    user.notifications.push({
      message,
      owner,
      read: false,
      createdAt: Date.now(),
    });

    await user.save();

    return res.status(201).json({ message: "Notificação enviada com sucesso" });
  }
);

// Rota para deletar comentários específicos (DELETE RESTful)
app.delete(
  "/publications/:publicationId/comments/:commentId",
  [
    param("publicationId").isMongoId().withMessage("ID de publicação inválido"),
    param("commentId").isMongoId().withMessage("ID de comentário inválido"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { publicationId, commentId } = req.params;

    const publication = await Publication.findOne({ _id: publicationId });

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    const commentIndex = publication.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );

    if (commentIndex == -1) {
      return res.status(404).json({ message: "Comentário não encontrado" });
    }

    publication.comments.splice(commentIndex, 1);

    await publication.save();
    res.status(200).json({ message: "Comentário deletado com sucesso" });
  }
);

// Rota para obter todos os comentários de uma publicação (GET RESTful)
app.get(
  "/publications/:publicationId/comments",
  [param("publicationId").isMongoId().withMessage("ID de publicação inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { publicationId } = req.params;

    const publication = await Publication.findOne({
      _id: publicationId,
    }).populate("comments.owner"); // Popula dados do dono do comentário

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    res.status(200).json({ comments: publication.comments });
  }
);

// Rota para adicionar comentários (POST RESTful)
app.post(
  "/publications/:publicationId/comments",
  [
    param("publicationId").isMongoId().withMessage("ID de publicação inválido"),
    body("user").isMongoId().withMessage("ID de usuário inválido"),
    body("comment")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Comentário não pode ser vazio"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user, comment } = req.body;
    const { publicationId } = req.params;
    const publication = await Publication.findOne({ _id: publicationId });

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
  }
);

app.patch("/users/:userId/notifications/mark-as-read", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate("notifications.owner");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    user.notifications.forEach((notification) => {
      notification.read = true;
    });

    await user.save();

    return res
      .status(200)
      .json({ message: "Notificações marcadas como lidas" });
  } catch (error) {
    console.log(error);
  }
});

// Rota para criar publicações com upload de imagem (POST RESTful)
app.post(
  "/publications",
  upload.single("image"),
  [
    body("owner").isMongoId().withMessage("ID de usuário inválido"),
    body("title")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Título não pode ser vazio"),
    body("description")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Descrição não pode ser vazia"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { owner, title, description } = req.body;

    const image = req.file ? req.file.path : null;

    const newPublication = new Publication({
      owner: owner, // ID do usuário dono
      title: title,
      description: description,
      image: image,
      comments: [], // Inicializa array vazio
    });

    await newPublication.save();

    console.log("Dados recebidos:", { title, description, image });
    res.status(201).json({
      message: "Publicação recebida com sucesso!",
      publication: newPublication,
    });
  }
);

// Rota para deletar publicações (DELETE RESTful)
app.delete(
  "/publications/:publicationId?",
  [
    param("publicationId").isMongoId().withMessage("ID de publicação inválido"),
    query("owner").isMongoId().withMessage("ID de usuário inválido"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { owner } = req.query;
    const { publicationId } = req.params;
    const publication = await Publication.findOneAndDelete({
      _id: publicationId,
      owner: owner,
    });

    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    res.status(200).json({ message: "Publicação deletada com sucesso" });
  }
);

// Rota para buscar todas publicações (GET RESTful)
app.get("/publications", async (req, res) => {
  const publications = await Publication.find()
    .populate("owner") // Popula dados do dono
    .populate("comments.owner"); // Popula donos dos comentários
  res.json(publications);
});

// Rota para editar publicação (PUT RESTful)
app.put(
  "/publications/:publicationId",
  upload.single("image"),
  [
    param("publicationId").isMongoId().withMessage("ID de publicação inválido"),
    body("owner").isMongoId().withMessage("ID de usuário inválido"),
    body("title")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Título não pode ser vazio"),
    body("description")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Descrição não pode ser vazia"),
  ],

  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log("erros", errors);
      return res.status(400).json({ errors: errors.array() });
    }

    const { owner, title, description } = req.body;
    const { publicationId } = req.params;

    let imagePath = null;
    if (req.file) {
      imagePath = req.file.path; // Atualiza imagem se fornecida
    }

    const publication = await Publication.findById({ _id: publicationId });
    if (!publication) {
      return res.status(404).json({ message: "Publicação não encontrada" });
    }

    publication.title = title;

    publication.description = description;

    if (imagePath) {
      publication.image = imagePath;
    } else if (imagePath == null) {
      publication.image = null;
    }
    await publication.save();

    res.status(200).json({
      message: "Publicação editada com sucesso",
      publication: publication,
    });
  }
);

// Rota para obter publicações de um usuário específico (GET RESTful)
app.get(
  "/users/:userId/publications",
  [param("userId").isMongoId().withMessage("ID de usuário inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const userPosts = await Publication.find({ owner: userId })
      .populate("comments.owner")
      .populate("owner");

    res.status(200).json({
      message: "Posts obtidos com sucesso",
      posts: userPosts,
      user: user,
    });
  }
);

// Rota de login (POST)
app.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email inválido"),
    body("password")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Senha não pode ser vazia")
      .isStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
    delete userWithoutPassword.password; // Remove senha da resposta

    res.status(200).json({
      message: "Login realizado com sucesso!",
      user: userWithoutPassword,
    });
  }
);

// Rota de cadastro (POST)
app.post(
  "/signup",
  [
    body("user")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Nome de usuário não pode ser vazio"),
    body("email").isEmail().withMessage("Email inválido"),
    body("password")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Senha não pode ser vazia")
      .isStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
      .withMessage("Senha inválida"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user, email, password } = req.body;

    // Verifica existência prévia
    const emailExists = await User.findOne({ email: email });
    const userExists = await User.findOne({ name: user });

    if (emailExists && userExists) {
      return res.status(409).json({
        message: "Este nome de usuário e e-mail já estão em uso.",
      });
    } else if (emailExists && !userExists) {
      return res.status(409).json({ message: "Esse e-mail já está em uso." });
    } else if (!emailExists && userExists) {
      return res
        .status(409)
        .json({ message: "Esse nome de usuário já está em uso." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: user,
      email: email,
      password: hashedPassword, // Senha hasheada
    });

    await newUser.save();

    res
      .status(200)
      .json({ message: "Usuário criado com sucesso!", user: newUser });
  }
);

// Rota para editar perfil (PUT RESTful)
app.put(
  "/users/:userId",
  upload.single("image"),
  [param("userId").isMongoId().withMessage("ID de usuário inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    console.log(errors.array());
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email } = req.body;
    const { userId } = req.params;

    const image = req.file ? req.file.path : null;

    const validationErrors = [];

    if (email !== undefined && email !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        validationErrors.push({
          msg: "Email inválido",
          param: "email",
          value: email,
        });
      }
    }
    if (name !== undefined && name !== "" && typeof name !== "string") {
      validationErrors.push({
        msg: "Nome deve ser texto válido",
        param: "name",
        value: name,
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validationErrors,
      });
    }

    const user = await User.findById({ _id: userId });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (name != null && name.replaceAll(" ", "") != "") {
      user.name = name;
    }

    if (email != null && email.replaceAll(" ", "") != "") {
      user.email = email;
    }

    if (image != null && image != "") {
      user.image = image;
    }

    await user.save();

    return res
      .status(200)
      .json({ message: "Perfil editado com sucesso!", user: user });
  }
);

// Rota para editar página do usuário (PUT RESTful)
app.put(
  "/users/:userId/userPage",
  upload.single("image"),
  [
    param("userId").isMongoId().withMessage("ID de usuário inválido"),
    body("description").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { description } = req.body;
    const { userId } = req.params;

    const image = req.file ? req.file.path : null;

    const user = await User.findById({ _id: userId });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (description != null && description.replaceAll(" ", "") != "") {
      user.userPageDescription = description;
    }

    if (image != null && image != "") {
      user.userPageImage = image;
    }

    await user.save();

    return res
      .status(200)
      .json({ message: "Perfil editado com sucesso!", user: user });
  }
);

// Rota para alterar senha (PUT RESTful)
app.put(
  "/users/:userId/password",
  [
    param("userId").isMongoId().withMessage("ID de usuário inválido"),
    body("newPassword")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Nova senha não pode ser vazia")
      .isStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
      .withMessage("Senha inválida"),
    body("oldPassword")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Senha antiga não pode ser vazia"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newPassword, oldPassword } = req.body;
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const samePassword = await verifyPassword(oldPassword, user.password);

    if (samePassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();
      return res.status(200).json({ message: "Senha alterada com sucesso" });
    }

    return res.status(401).json({ message: "Senha incorreta" });
  }
);

// Rota para obter informações do usuário (GET RESTful)
app.get(
  "/users/:userId",
  [param("userId").isMongoId().withMessage("ID de usuário inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.status(200).json({ user: user });
  }
);

app.post(
  "/users/:userId/friends/:friendId",
  [
    param("userId").isMongoId().withMessage("ID de usuário inválido"),
    param("friendId").isMongoId().withMessage("ID de amigo inválido"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, friendId } = req.params;

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const existingFriendship = user.friends.find(
      (f) => f.user.toString() === friendId
    );

    if (existingFriendship) {
      return res.status(409).json({ message: "Relação de amizade já existe" });
    }

    await User.findByIdAndUpdate(userId, {
      $push: {
        friends: {
          user: friendId,
          status: "pending",
          sender: userId,
        },
      },
    });

    await User.findByIdAndUpdate(friendId, {
      $push: {
        friends: {
          user: userId,
          status: "pending",
          sender: userId,
        },
      },
    });

    return res.status(200).json({ message: "Solicitação enviada" });
  }
);

app.get(
  "/users/:userId/friends",
  [param("userId").isMongoId().withMessage("ID de usuário inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate("friends.user")
      .populate("notifications.owner");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.status(200).json({ friends: user.friends });
  }
);

app.patch(
  "/users/:userId/friends/:friendId",
  [
    param("userId").isMongoId().withMessage("ID de usuário inválido"),
    param("friendId").isMongoId().withMessage("ID de amigo inválido"),
    body("status")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Status não pode ser vazio"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const { userId, friendId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const friend = user.friends.find(
      (friend) => friend.user._id.toString() === friendId
    );
    if (!friend) {
      return res.status(404).json({ message: "Amigo não encontrado" });
    }

    friend.status = status;

    const friendUser = await User.findById(friendId);

    if (!friendUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const otherFriend = friendUser.friends.find(
      (friend) => friend.user._id.toString() === userId
    );

    otherFriend.status = status;

    await user.save();
    await friendUser.save();

    return res.status(200).json({ message: "Status atualizado com sucesso" });
  }
);

app.delete(
  "/users/:userId/friends/:friendId",
  [
    param("userId").isMongoId().withMessage("ID de usuário inválido"),
    param("friendId").isMongoId().withMessage("ID de amigo inválido"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, friendId } = req.params;

    // Verificar se os usuários existem
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Remover a amizade do usuário
    await User.findByIdAndUpdate(userId, {
      $pull: {
        friends: { user: friendId },
      },
    });

    // Remover a amizade do amigo
    await User.findByIdAndUpdate(friendId, {
      $pull: {
        friends: { user: userId },
      },
    });

    return res.status(200).json({ message: "Amizade removida com sucesso" });
  }
);

app.get(
  "/conversation/:userId/:friendId",
  [
    param("userId").isMongoId().withMessage("ID de usuário inválido"),
    param("friendId").isMongoId().withMessage("ID de amigo inválido"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, friendId } = req.params;

    //Verificara se já existe uma conversa entre os usuários
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, friendId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [userId, friendId],
        lastMessage: { content: "" },
      });
      await conversation.save();
    }

    //Buscar mensagens da conversa
    const messages = await Message.find({
      conversation: conversation._id,
    })
      .sort({ createdAt: 1 })
      .populate("sender");

    res.status(200).json({ conversation, messages });
  }
);

app.post(
  "/conversations/:conversationId/message",
  [
    body("conversationId").isMongoId().withMessage("ID de conversa inválido"),
    body("senderId").isMongoId().withMessage("ID de usuário inválido"),
    body("content")
      .notEmpty()
      .withMessage("Conteúdo da mensagem é obrigatório"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId, senderId, content } = req.body;

    const message = new Message({
      conversation: conversationId,
      sender: senderId,
      content: content,
    });

    await message.save();

    //Atualziar a última mensagem da conversa
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        content,
        sender: senderId,
        timestamp: new Date(),
      },
    });

    res.status(201).json(message);
  }
);

app.get(
  "/users/:userId/random-users",
  [param("userId").isMongoId().withMessage("ID de usuário inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    const allUsers = await User.find({ _id: { $ne: userId } }); // Exclui o usuário atual

    res.status(200).json(allUsers);
  }
);

app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: "Erro no upload de arquivo" });
  }

  res.status(500).json({
    message: "Ocorreu um erro interno no servidor",
    error: process.env.NODE_ENV === "development" ? error.message : "Oculto",
  });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
