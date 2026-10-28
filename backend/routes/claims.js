const express = require("express");
const supabase = require("../supabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");

const router = express.Router();

router.get("/mine", requireAuth, requireRole("community"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("*, donation:donations(*, donor:users!donor_id(id,full_name,email,phone))")
      .eq("community_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return fail(res, "Could not load your claims.", 500);
    }
    return ok(res, { claims: data || [] });
  } catch (err) {
    console.error(err);
    return fail(res, "Could not load your claims.", 500);
  }
});

router.get("/for-donation/:donationId", requireAuth, async (req, res) => {
  try {
    const { data: donation, error: dError } = await supabase
      .from("donations")
      .select("*")
      .eq("id", req.params.donationId)
      .single();

    if (dError || !donation) return fail(res, "Donation not found.", 404);
    if (req.user.role !== "admin" && donation.donor_id !== req.user.id) {
      return fail(res, "You cannot view these claims.", 403);
    }

    const { data, error } = await supabase
      .from("claims")
      .select("*, community:users!community_id(id,full_name,email,phone)")
      .eq("donation_id", req.params.donationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return fail(res, "Could not load claims.", 500);
    }
    return ok(res, { claims: data || [] });
  } catch (err) {
    console.error(err);
    return fail(res, "Could not load claims.", 500);
  }
});

router.post("/", requireAuth, requireRole("community"), async (req, res) => {
  try {
    const donationId = String(req.body.donation_id || "");
    const message = String(req.body.message || "").trim();

    const { data: donation, error: dError } = await supabase
      .from("donations")
      .select("*")
      .eq("id", donationId)
      .single();

    if (dError || !donation) return fail(res, "Donation not found.", 404);
    if (donation.status !== "available") return fail(res, "This donation is no longer available.", 409);
    if (donation.donor_id === req.user.id) return fail(res, "You cannot claim your own donation.");

    const { data: existing } = await supabase
      .from("claims")
      .select("id,status")
      .eq("donation_id", donationId)
      .eq("community_id", req.user.id)
      .maybeSingle();

    if (existing) return fail(res, "You have already requested this donation.", 409);

    const { data, error } = await supabase
      .from("claims")
      .insert({
        donation_id: donationId,
        community_id: req.user.id,
        message: message || null
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return fail(res, "Could not submit the claim.", 500);
    }
    return ok(res, { claim: data }, 201);
  } catch (err) {
    console.error(err);
    return fail(res, "Could not submit the claim.", 500);
  }
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const claimId = req.params.id;
    const newStatus = String(req.body.status || "");
    const allowed = new Set(["approved", "rejected", "cancelled", "completed"]);
    if (!allowed.has(newStatus)) return fail(res, "Invalid claim status.");

    const { data: claim, error: cError } = await supabase
      .from("claims")
      .select("*, donation:donations(*)")
      .eq("id", claimId)
      .single();

    if (cError || !claim) return fail(res, "Claim not found.", 404);

    const isCommunity = req.user.id === claim.community_id;
    const isDonor = req.user.id === claim.donation.donor_id;
    const isAdmin = req.user.role === "admin";

    if (!isCommunity && !isDonor && !isAdmin) return fail(res, "You cannot change this claim.", 403);

    if (newStatus === "approved" && !isDonor && !isAdmin) {
      return fail(res, "Only the donor can approve a claim.", 403);
    }
    if (newStatus === "rejected" && !isDonor && !isAdmin) {
      return fail(res, "Only the donor can reject a claim.", 403);
    }
    if (newStatus === "completed" && !isCommunity && !isAdmin) {
      return fail(res, "Only the community group can complete a claim.", 403);
    }

    if (newStatus === "approved") {
      const { data: otherApproved, error: otherError } = await supabase
        .from("claims")
        .select("id")
        .eq("donation_id", claim.donation_id)
        .eq("status", "approved")
        .neq("id", claimId);

      if (otherError) return fail(res, "Could not check existing approvals.", 500);
      if (otherApproved && otherApproved.length > 0) {
        return fail(res, "Another claim has already been approved for this donation.", 409);
      }
    }

    const { data: updatedClaim, error: updateError } = await supabase
      .from("claims")
      .update({ status: newStatus })
      .eq("id", claimId)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      return fail(res, "Could not update the claim.", 500);
    }

    if (newStatus === "approved") {
      const { error } = await supabase
        .from("donations")
        .update({ status: "claimed" })
        .eq("id", claim.donation_id);
      if (error) console.error(error);
    }

    if (["rejected", "cancelled"].includes(newStatus)) {
      const { data: remaining } = await supabase
        .from("claims")
        .select("id")
        .eq("donation_id", claim.donation_id)
        .eq("status", "approved");
      if (!remaining || remaining.length === 0) {
        await supabase.from("donations")
          .update({ status: "available" })
          .eq("id", claim.donation_id)
          .eq("status", "claimed");
      }
    }

    if (newStatus === "completed") {
      await supabase.from("donations")
        .update({ status: "completed" })
        .eq("id", claim.donation_id);
    }

    return ok(res, { claim: updatedClaim });
  } catch (err) {
    console.error(err);
    return fail(res, "Could not update the claim.", 500);
  }
});

module.exports = router;
