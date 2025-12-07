import { Router } from "express";
import { bookAppointment } from "../controllers/bookAppointment";

const router = Router();

router.post("/bookAppointment", bookAppointment);

export default router;