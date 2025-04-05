const jwt = require("jsonwebtoken");

const autenticar = (req, res, next) => {
  const token = req.cookies.access_token;

  if (!token) return res.status(401).json({ message: "Acesso não autorizado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie("access_token");
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
};

module.exports = autenticar;
