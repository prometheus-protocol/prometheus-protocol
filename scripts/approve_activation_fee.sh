dfx canister call icrc1_ledger icrc2_approve '(record { 
    spender = record { owner = principal "avqkn-guaaa-aaaaa-qaaea-cai"; subaccount = null }; 
    amount = 55_00000000;
})'