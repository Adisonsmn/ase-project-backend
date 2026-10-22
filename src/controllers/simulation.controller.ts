import type { Request, RequestHandler } from "express";
import * as simulationService from "../services/simulation.service";
import type { IdParam } from "../schemas/common.schema";
import type {
  InstrumentCodeParam,
  InstrumentHistoryQuery,
  ListInstrumentQuery,
  ListSessionQuery,
} from "../schemas/simulation.schema";
import { AppError } from "../utils/app.error";

const requireUserId = (req: Request) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
};

// --- Instrumen (publik) ------------------------------------------------------

export const listInstruments: RequestHandler = async (req, res, next) => {
  try {
    const query = req.validated?.query as ListInstrumentQuery;
    res.status(200).json(await simulationService.listInstruments(query));
  } catch (error) {
    next(error);
  }
};

export const instrumentDetail: RequestHandler = async (req, res, next) => {
  try {
    const { code } = req.validated?.params as InstrumentCodeParam;
    res.status(200).json(await simulationService.getInstrument(code));
  } catch (error) {
    next(error);
  }
};

export const instrumentHistory: RequestHandler = async (req, res, next) => {
  try {
    const { code } = req.validated?.params as InstrumentCodeParam;
    const query = req.validated?.query as InstrumentHistoryQuery;
    res
      .status(200)
      .json(await simulationService.getInstrumentHistory(code, query));
  } catch (error) {
    next(error);
  }
};

// --- Sesi --------------------------------------------------------------------

export const preview: RequestHandler = async (req, res, next) => {
  try {
    res.status(200).json(await simulationService.previewPurchase(req.body));
  } catch (error) {
    next(error);
  }
};

export const createSession: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const session = await simulationService.createSession(userId, req.body);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

export const listSessions: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const query = req.validated?.query as ListSessionQuery;
    res.status(200).json(await simulationService.listSessions(userId, query));
  } catch (error) {
    next(error);
  }
};

export const sessionDetail: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;
    res.status(200).json(await simulationService.getSession(userId, id));
  } catch (error) {
    next(error);
  }
};

export const advance: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.validated?.params as IdParam;
    res.status(200).json(await simulationService.advanceSession(userId, id));
  } catch (error) {
    next(error);
  }
};
