import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../src/app";

// Body parser gagal sebelum route mana pun berjalan, jadi tes ini tidak butuh
// database.
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const postLogin = (body: string) =>
  fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

describe("errorMiddleware", () => {
  test("JSON rusak dijawab 400, bukan 500", async () => {
    const response = await postLogin('{"email": "rani@gmail.com", "password": ');

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe("Format data request tidak valid.");
  });

  test("body melebihi batas dijawab 413", async () => {
    const response = await postLogin(
      JSON.stringify({ email: "rani@gmail.com", password: "a".repeat(200_000) }),
    );

    expect(response.status).toBe(413);
  });
});
