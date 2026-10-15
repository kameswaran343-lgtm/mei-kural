import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kuralRouter from "./kural";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kuralRouter);

export default router;
