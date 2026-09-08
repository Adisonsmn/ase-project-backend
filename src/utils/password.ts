import argon2 from "argon2";

export const hashPassword = (pass: string) =>{
    return argon2.hash(pass, {
        type: argon2.argon2id,
    });
}

export const verifyPassword = (pass: string, hssh: string) =>{
    return argon2.verify(hssh, pass);
}