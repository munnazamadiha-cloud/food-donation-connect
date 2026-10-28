const express = require("express");
const supabase = require("../supabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");

const router = express.Router();

const allowedUnits = new Set(["kg", "litres", "packets", "boxes", "meals", "items"]);
const allowedStatuses = new Set(["available", "claimed", "picked_up", "completed", "cancelled"]);

function validateDonation(body) {
  const food_name = String(body.food_name || "").trim();
  const description = String(body.description || "").trim();
  const quantity = Number(body.quantity);
  const unit = String(body.unit || "");
  const location = String(body.location || "").trim();
  const pickup_start = new Date(body.pickup_start);
  const pickup_end = new Date(body.pickup_end);

  if (food_name.length < 2) return { error: "Food name is required." };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Quantity must be greater than 0." };
  if (!allowedUnits.has(unit)) return { error: "Choose a valid quantity unit." };
  if (!location) return { error: "Pickup location is required." };
  if (Number.isNaN(pickup_start.getTime()) || Number.isNaN(pickup_end.getTime())) {
    return { error: "Enter valid pickup dates and times." };
  }
  if (pickup_end <= pickup_start) return { error: "Pickup end must be after pickup start." };
  return {
    value: {
      food_name,
      description: description || null,
      quantity,
      unit,
      pickup_start: pickup_start.toISOString(),
      pickup_end: pickup_end.toISOString(),
      location
    }
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabase
      .from("donations")
      .select("*, donor:users!donor_id(id,full_name,email,phone)")
      .order("created_at", { ascending: false });

    if (status && allowedStatuses.has(status)) query = query.eq("status", status);
    if (search) query = query.ilike("food_name", `%${String(search).trim()}%`);

    const { data, error } = await query;
    if (error) {
      console.error(error);
      return fail(res, "Could not load donations.", 500);
    }
    return ok(res, { donations: data || [] });
  } catch (err) {
    console.error(err);
    return fail(res, "Could not load donations.", 500);
  }
});

router.post("/", requireAuth, requireRole("donor"), async (req, res) => {
  try {
    const parsed = validateDonation(req.body);
    if (parsed.error) return fail(res, parsed.error);

    const { data, error } = await supabase
      .from("donations")
      .insert({ ...parsed.value, donor_id: req.user.id })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return fail(res, "Could not publish the donation.", 500);
    }
    return ok(res, { donation: data }, 201);
  } catch (err) {
    console.error(err);
    return fail(res, "Could not publish the donation.", 500);
  }
});

router.get("/mine", requireAuth, async (req, res) => {
  try {
    let query = supabase
      .from("donations")
      .select("*")
      .eq("donor_id", req.user.id)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error(error);
      return fail(res, "Could not load your donations.", 500);
    }
    return ok(res, { donations: data || [] });
  } catch (err) {
    console.error(err);
    return fail(res, "Could not load your donations.", 500);
  }
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const status = String(req.body.status || "");
    if (!allowedStatuses.has(status)) return fail(res, "Invalid donation status.");

    const { data: donation, error: findError } = await supabase
      .from("donations")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !donation) return fail(res, "Donation not found.", 404);

    if (req.user.role !== "admin" && donation.donor_id !== req.user.id) {
      return fail(res, "You cannot change this donation.", 403);
    }

    if (status === "available" && donation.status !== "available") {
      return fail(res, "Only an already available donation can remain available.");
    }

    const { data, error } = await supabase
      .from("donations")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return fail(res, "Could not update donation status.", 500);
    }
    return ok(res, { donation: data });
  } catch (err) {
    console.error(err);
    return fail(res, "Could not update donation status.", 500);
  }
});

module.exports = router;
