require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const supabase = require("./supabase");

const authRoutes = require("./routes/auth");
const donationRoutes = require("./routes/donations");
const claimRoutes = require("./routes/claims");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (req, res) => {
  const { error } = await supabase.from("users").select("id", { count: "exact", head: true });
  if (error) return res.status(503).json({ success: false, status: "database unavailable" });
  return res.json({ success: true, status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/admin", adminRoutes);

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("*splat", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, error: "API route not found." });
  }
  return res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ success: false, error: "An unexpected server error occurred." });
});

async function ensureAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!email || !password) {
    console.warn("ADMIN_EMAIL/ADMIN_PASSWORD are not set. Admin auto-creation skipped.");
    return;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const { data: existing, error: findError } = await supabase
    .from("users")
    .select("id,email,role")
    .eq("email", email)
    .maybeSingle();

  if (findError) throw findError;

  if (!existing) {
    const password_hash = await bcrypt.hash(password, 12);
    const { error } = await supabase.from("users").insert({
      full_name: "MREC Administrator",
      email,
      password_hash,
      role: "admin"
    });
    if (error) throw error;
    console.log(`Admin account created for ${email}.`);
  } else if (existing.role !== "admin") {
    const { error } = await supabase.from("users").update({ role: "admin" }).eq("id", existing.id);
    if (error) throw error;
    console.log(`Existing account ${email} promoted to admin.`);
  }
}

async function start() {
  try {
    await ensureAdmin();
    app.listen(PORT, () => {
      console.log(`Food Donation Connect running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

start();
