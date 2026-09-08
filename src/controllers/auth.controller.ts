import type { RequestHandler } from "express";
import * as authService from "../services/auth.service";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.logout(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
