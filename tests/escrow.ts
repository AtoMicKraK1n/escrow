import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { before } from "mocha";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { randomBytes } from "node:crypto";
import { assert } from "chai";
describe("escrow", () => {
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Escrow as Program<Escrow>;

  let maker = anchor.web3.Keypair.generate();
  let taker = anchor.web3.Keypair.generate();
  let mintA;
  let mintB;
  let makerMintAtaA;
  let takerMintAtaB;
  let takerMintAtaA;
  let makerMintAtaB;
  let escrow;
  let vault;
  let receiveAmount = new anchor.BN(50);
  let depositAmount = new anchor.BN(50);
  let seed = new anchor.BN(randomBytes(8));
  before(async () => {
    let makerAirdrop = await provider.connection.requestAirdrop(
      maker.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(makerAirdrop);
    let takerAirdrop = await provider.connection.requestAirdrop(
      taker.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(takerAirdrop);
    mintA = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      6
    );
    mintB = await createMint(
      provider.connection,
      taker,
      taker.publicKey,
      null,
      6
    );
    makerMintAtaA = await createAccount(
      provider.connection,
      maker,
      mintA,
      maker.publicKey
    );
    takerMintAtaB = await createAccount(
      provider.connection,
      taker,
      mintB,
      taker.publicKey
    );
    takerMintAtaA = await createAccount(
      provider.connection,
      taker,
      mintA,
      taker.publicKey
    );
    makerMintAtaB = await createAccount(
      provider.connection,
      maker,
      mintB,
      maker.publicKey
    );
    await mintTo(
      provider.connection,
      maker,
      mintA,
      makerMintAtaA,
      maker.publicKey,
      100
    );
    await mintTo(
      provider.connection,
      taker,
      mintB,
      takerMintAtaB,
      taker.publicKey,
      100
    );
    [escrow] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toBuffer("le", 8),
      ],
      program.programId
    );
    vault = await anchor.utils.token.associatedAddress({
      mint: mintA,
      owner: escrow,
    });
  });

  it("Perform make", async () => {
    await program.methods
      .initializeEscrow(seed, receiveAmount, depositAmount)
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        mintB,
        makerAtaA: makerMintAtaA.publicKey,
        escrow,
        vault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();
    let vaultAmount = await getAccount(provider.connection, vault);
    assert.equal(vaultAmount.amount, BigInt(depositAmount.toString()));
  }); 
  it("Perform Take", async () => {
    await program.methods
      .takerDepositWithdrawAndClose()
      .accountsPartial({
        taker: taker.publicKey,
        maker: maker.publicKey,
        mintA,
        mintB,
        takerAtaA: takerMintAtaA.publicKey,
        takerAtaB: takerMintAtaB.publicKey,
        makerAtaB: makerMintAtaB.publicKey,
        escrow,
        vault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([taker])
      .rpc();
  });
  it("Perform Refund", async () => {
    await program.methods
      .makeRefund()
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        makerAtaA: makerMintAtaA.publicKey,
        escrow,
        vault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();
    await program.methods
      .makeRefund()
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        makerAtaA: makerMintAtaA.publicKey,
        escrow,
        vault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();
  });
});