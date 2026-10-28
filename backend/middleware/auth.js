const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

function getToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Authentication required." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase
      .from("users")
      .select("id,full_name,email,role,phone,created_at")
      .eq("id", payload.sub)
      .single();

    if (error || !user) return res.status(401).json({ error: "Session is invalid." });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Session is invalid or expired." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission for this action." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
