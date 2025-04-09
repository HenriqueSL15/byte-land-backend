const mongoose = require("mongoose");

// Schema do usuário (define estrutura dos dados no MongoDB)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Nome obrigatório e único
  email: { type: String, required: true, unique: true }, // Email obrigatório e único
  password: { type: String, required: true }, // Senha obrigatória
  image: {
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/711/711769.png", // Imagem padrão
  },
  userPageImage: {
    type: String,
    default:
      "https://www.solidbackgrounds.com/images/1920x1080/1920x1080-black-solid-color-background.jpg", // Banner padrão
  },
  userPageDescription: {
    type: String,
    default: "Nenhuma descrição", // Descrição inicial
  },
  createdAt: {
    type: Date,
    default: Date.now(), // Data de criação automática
  },
  notifications: [
    {
      message: { type: String, required: true },
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
      owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  ],
  friends: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
  ],
});

// Modelo do usuário (interface com a coleção 'users')
const User = mongoose.model("User", userSchema);
module.exports = User;
