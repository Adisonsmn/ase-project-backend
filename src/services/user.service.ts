import { prisma } from "../config/database";
import type { UpdateMeInput } from "../schemas/user.schema";
import { AppError } from "../utils/app.error";
import { isUniqueViolation } from "../utils/prisma-error";

const userSelectFields = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  dateOfBirth: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelectFields,
  });

  if (!user || !user.isActive) {
    throw new AppError(404, "User not found or inactive");
  }

  return user;
};

export const updateProfile = async (userId: string, input: UpdateMeInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    throw new AppError(404, "User not found or inactive");
  }

  if (input.username && input.username !== user.username) {
    const existingUsername = await prisma.user.findFirst({
      where: {
        username: input.username,
        NOT: { id: userId },
      },
    });

    if (existingUsername) {
      throw new AppError(409, "Username already taken");
    }
  }

  const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : undefined;

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.username !== undefined && { username: input.username }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(dateOfBirth !== undefined && { dateOfBirth }),
      },
      select: userSelectFields,
    });
  } catch (error) {
    // User lain mengambil username yang sama di antara pengecekan dan update.
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Username already taken");
    }
    throw error;
  }
};
