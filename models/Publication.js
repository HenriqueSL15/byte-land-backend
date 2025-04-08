const mongoose = require("mongoose");

// Schema da publicação (relacionado ao usuário via ObjectId)
const publicationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Dono da publicação
  title: { type: String, required: true }, // Título obrigatório
  description: { type: String, required: true }, // Descrição obrigatória
  image: { type: String }, // Caminho da imagem (opcional)
  createdAt: { type: Date, default: Date.now }, // Data de criação
  comments: [
    // Array de comentários
    {
      owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Dono do comentário
      comment: String, // Texto do comentário
      createdAt: { type: Date, default: Date.now }, // Data do comentário
    },
  ],
});

// Modelo da publicação (interface com a coleção 'publications')
const Publication = mongoose.model("Publication", publicationSchema);
module.exports = Publication;
