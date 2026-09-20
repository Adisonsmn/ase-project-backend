import { z } from "zod";

export const updateMeSchema = z.object({
  body: z
    .object({
      displayName: z
        .string()
        .min(2, "Display name minimal 2 karakter")
        .max(50, "Display name maksimal 50 karakter")
        .optional(),
      username: z
        .string()
        .min(3, "Username minimal 3 karakter")
        .max(30, "Username maksimal 30 karakter")
        .regex(
          /^[a-zA-Z0-9_]+$/,
          "Username hanya boleh berisi huruf, angka, dan underscore",
        )
        .optional(),
      avatarUrl: z.url("Format URL avatar tidak valid").optional(),
      dateOfBirth: z
        .union([z.iso.date(), z.iso.datetime({ offset: true })])
        .refine(
          (value) => new Date(value).getTime() <= Date.now(),
          "Tanggal lahir tidak boleh di masa depan",
        )
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Minimal satu field harus diisi untuk memperbarui profil.",
    }),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>["body"];
