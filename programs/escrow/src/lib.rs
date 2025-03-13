use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

pub use instructions::*;
pub use state::*;

declare_id!("GkiKqSVfnU2y4TeUW7up2JS9Z8g1yjGYJ8x2QNf4K6Y");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<Make>,
        seed: u64,
        recieve_amount: u64,
        deposit_amount: u64,
    ) -> Result<()> {
        msg!("Initialize Escrow for: {:?}", ctx.program_id);
        ctx.accounts
            .initialize_escrow(seed, ctx.bumps, recieve_amount)?;

        msg!("Deposit to Escrow: {:?}", ctx.program_id);
        ctx.accounts.deposit_into_escrow(deposit_amount)?;

        Ok(())
    }

    pub fn taker_deposit_withdraw_and_close(ctx: Context<Take>) -> Result<()> {
        //The Taker of an escrow can deposit tokens of mint_b to the maker and recieve tokens of mint_a that the maker deposited.

        msg!("Deposit amount requested by the maker");
        ctx.accounts.deposit()?;

        msg!("witdraw the token being exchanged and close the vault");
        ctx.accounts.withdraw_and_close_vault()?;

        Ok(())
    }

    pub fn make_refund(ctx: Context<Refund>) -> Result<()> {
        //The maker of an escrow can refund the tokens from the vault and close the escrow account.
        msg!("Deposit amount requested by the maker");
        ctx.accounts.refund_and_close_vault()?;

        Ok(())
    }
}