import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptAccount, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";
import { randomBytes } from "crypto";
import { expect } from 'chai';

describe("escrow", () => {
  // Configure the client to use the local cluster. 
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<Escrow>;

  const maker = anchor.web3.Keypair.generate();
  const taker = anchor.web3.Keypair.generate();
  const mintA = anchor.web3.Keypair.generate();
  const mintB = anchor.web3.Keypair.generate();
  const seed = new BN(randomBytes(8));
  const tokenProgram = TOKEN_2022_PROGRAM_ID;
  
  // Generate escrow PDA first
  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), maker.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  // Create ATAs with the correct owners
  const makerAtaA = getAssociatedTokenAddressSync(maker.publicKey, mintA.publicKey, false, tokenProgram);
  const vault = getAssociatedTokenAddressSync(escrow, mintA.publicKey, false, tokenProgram);

  const accounts = {
    maker: maker.publicKey,
    mintA: mintA.publicKey,
    mintB: mintB.publicKey,
    makerAtaA,
    escrow,
    vault,
    tokenProgram,
  };

  it("should airdrop SOL and create token mints", async () => {
    try {
      // First, airdrop SOL to the provider wallet
      const airdropTx = await provider.connection.requestAirdrop(
        provider.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropTx);

      let lamports = await getMinimumBalanceForRentExemptMint(program.provider.connection);
      let tx = new anchor.web3.Transaction();
      
      // Add instructions
      tx.add(
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: maker.publicKey,
          lamports: 0.2 * LAMPORTS_PER_SOL,
        }),
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: taker.publicKey,
          lamports: 0.2 * LAMPORTS_PER_SOL,
        }),
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: mintA.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: tokenProgram,
        }),
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: mintB.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: tokenProgram,
        }),
        createInitializeMint2Instruction(mintA.publicKey, 6,  maker.publicKey, null, tokenProgram),
        createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, makerAtaA, maker.publicKey, mintA.publicKey, tokenProgram),
        createMintToInstruction(mintA.publicKey, makerAtaA, maker.publicKey, 1e9 ,undefined ,tokenProgram),
        createInitializeMint2Instruction(mintB.publicKey, 6,  taker.publicKey, null, tokenProgram),
        //createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, takerAtaB, maker.publicKey, mintA.publicKey, tokenProgram),
        //createMintToInstruction(mintB.publicKey, takerAtaB, taker.publicKey, 1e9 ,undefined ,tokenProgram),
      );

      console.log({maker:maker.publicKey.toString(), taker:taker.publicKey.toString(), mintA:mintA.publicKey.toString(), mintB:mintB.publicKey.toString()});
      await provider.sendAndConfirm(tx, [maker, taker, mintA, mintB]);
    } catch (error) {
      throw new Error(`Airdrop failed: ${error.message}`);
    }
  });

  it("should initialize escrow successfully", async () => {
    try {
      const tx = await program.methods.initializeEscrow(
        new BN(1),
        new BN(1),
        new BN(1),
      ).accountsPartial({...accounts}).rpc();
      
      expect(tx).to.be.a('string');
      expect(tx.length).to.equal(88);
      
      // Verify escrow account exists
      const escrowAccount = await program.provider.connection.getAccountInfo(escrow);
      expect(escrowAccount).to.not.be.null;
    } catch (error) {
      throw new Error(`Escrow initialization failed: ${error.message}`);
    }
  });
});


