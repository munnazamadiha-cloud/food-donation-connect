const express = require("express");
const supabase = require("../supabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/summary", async (req, res) => {
  try {
    const [users, donations, claims] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("donations").select("id", { count: "exact", head: true }),
      supabase.from("claims").select("id", { count: "exact", head: true })
    ]);
    return ok(res, {
      users: users.count || 0,
      donations: donations.count || 0,
      claims: claims.count || 0
    });
  } catch (err) {
    console.error(err);
    return fail(res, "Could not load admin summary.", 500);
  }
});

router.get("/users", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id,full_name,email,role,phone,created_at")
    .order("created_at", { ascending: false });
  if (error) return fail(res, "Could not load users.", 500);
  return ok(res, { users: data || [] });
});

router.get("/donations", async (req, res) => {
  const { data, error } = await supabase
    .from("donations")
    .select("*, donor:users!donor_id(id,full_name,email)")
    .order("created_at", { ascending: false });
  if (error) return fail(res, "Could not load donations.", 500);
  return ok(res, { donations: data || [] });
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) return fail(res, "You cannot delete your own admin account.");
  const { error } = await supabase.from("users").delete().eq("id", req.params.id);
  if (error) {
    console.error(error);
    return fail(res, "Could not delete user.", 500);
  }
  return ok(res, { message: "User deleted." });
});

module.exports = router;
