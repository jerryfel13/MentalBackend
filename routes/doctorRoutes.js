const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabase");

// ===== BOOK APPOINTMENT =====
router.post("/bookAppointment", async (req, res) => {
  try {
    const { userId, doctorName, consultationType, date, time, paymentMethod, mobileNumber } = req.body;

    if (!userId || !doctorName || !consultationType || !date || !time || !paymentMethod || !mobileNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          user_id: userId,
          doctor_name: doctorName,
          consultation_type: consultationType,
          appointment_date: date,
          appointment_time: time,
          payment_method: paymentMethod,
          mobile_number: mobileNumber
        }
      ]);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(201).json({
      message: "Appointment booked successfully",
      appointment: data
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to book appointment", error: err.message });
  }
});

module.exports = router;
