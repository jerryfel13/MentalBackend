const express = require("express");
const router = express.Router();
const { bookAppointment } = require("../controllers/bookAppointment");

router.post("/bookAppointment", bookAppointment);

module.exports = router;
