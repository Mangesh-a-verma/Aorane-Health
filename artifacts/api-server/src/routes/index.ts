import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./modules/auth";
import usersRouter from "./modules/users";
import foodRouter from "./modules/food";
import healthTrackingRouter from "./modules/health";
import medicineRouter from "./modules/medicine";
import medicalRouter from "./modules/medical";
import bloodRouter from "./modules/blood";
import businessRouter from "./modules/business";
import adminRouter from "./modules/admin";
import aiRouter from "./modules/ai";
import stressRouter from "./modules/stress";
import familyRouter from "./modules/family";
import periodRouter from "./modules/period";
import paymentRouter from "./modules/payment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(foodRouter);
router.use(healthTrackingRouter);
router.use(medicineRouter);
router.use(medicalRouter);
router.use(bloodRouter);
router.use(businessRouter);
router.use(adminRouter);
router.use(aiRouter);
router.use(stressRouter);
router.use(familyRouter);
router.use(periodRouter);
router.use(paymentRouter);

export default router;
