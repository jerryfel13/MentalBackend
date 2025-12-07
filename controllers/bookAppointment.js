const { supabase } = require('../config/supabase');

exports.bookAppointment = async (req, res) => {
  try {
    const { userId, doctorName, consultationType, date, time } = req.body;

    if (!userId || !doctorName || !consultationType || !date || !time) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const { data, error } = await supabase.rpc("book_appointment", {
      p_user_id: userId,
      p_doctor_name: doctorName,
      p_consultation_type: consultationType,
      p_appointment_date: date,
      p_appointment_time: time,
    });

    if (error) {
      console.error("Supabase RPC error:", error);
      return res.status(500).json({
        message: "Failed to book appointment",
        error,
      });
    }

    return res.status(201).json({
      message: "Appointment booked successfully",
      appointment: data,
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
