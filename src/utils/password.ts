import argon2 from "argon2";

// Batas minimum rekomendasi OWASP untuk argon2id (m=19 MiB, t=2, p=1).
// Default library (64 MiB, t=3, p=4) terlalu berat untuk container ber-CPU kecil.
const HASH_OPTIONS = {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
};

export const hashPassword = (pass: string) =>{
    return argon2.hash(pass, {
        type: argon2.argon2id,
        ...HASH_OPTIONS,
    });
}

export const verifyPassword = (pass: string, hssh: string) =>{
    return argon2.verify(hssh, pass);
}

/** True jika hash dibuat dengan parameter lama dan perlu di-hash ulang. */
export const passwordNeedsRehash = (hssh: string) =>{
    return argon2.needsRehash(hssh, HASH_OPTIONS);
}
