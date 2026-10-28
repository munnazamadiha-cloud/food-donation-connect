const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many authentication attempts. Try again later." }
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    phone: user.phone || null
  };
}

router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { full_name, email, password, role, phone } = req.body;
    const cleanName = String(full_name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim();

    if (cleanName.length < 2) return fail(res, "Full name must contain at least 2 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return fail(res, "Enter a valid email address.");
    if (String(password || "").length < 8) return fail(res, "Password must be at least 8 characters.");
    if (!["donor", "community"].includes(role)) return fail(res, "Choose donor or community group.");

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existing) return fail(res, "An account with this email already exists.", 409);

    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from("users")
      .insert({
        full_name: cleanName,
        email: cleanEmail,
        password_hash,
        role,
        phone: cleanPhone || null
      })
      .select("id,full_name,email,role,phone,created_at")
      .single();

    if (error) {
      console.error(error);
      return fail(res, "Could not create the account.", 500);
    }

    return ok(res, { user: publicUser(user), token: signToken(user) }, 201);
  } catch (err) {
    console.error(err);
    return fail(res, "Could not create the account.", 500);
  }
});

router.post("/signin", authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) return fail(res, "Email and password are required.");

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error(error);
      return fail(res, "Unable to sign in right now.", 500);
    }

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return fail(res, "Invalid email or password.", 401);
    }

    return ok(res, { user: publicUser(user), token: signToken(user) });
  } catch (err) {
    console.error(err);
    return fail(res, "Unable to sign in right now.", 500);
  }
});

router.get("/me", requireAuth, (req, res) => ok(res, { user: req.user }));

module.exports = router;
