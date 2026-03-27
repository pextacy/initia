// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FeeDistributor} from "../contracts/FeeDistributor.sol";
import {PoolRegistry} from "../contracts/PoolRegistry.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract FeeDistributorTest is Test {
    FeeDistributor distributor;
    PoolRegistry   registry;
    MockToken      token;

    address owner    = address(this);
    address treasury = address(0xffff);
    address alice    = address(0xA11CE);
    address router   = address(0x1234);

    bytes32 poolId;

    function setUp() public {
        token       = new MockToken();
        registry    = new PoolRegistry();
        distributor = new FeeDistributor(owner, treasury);
        distributor.setRegistry(address(registry));
        distributor.setRouter(router);

        // Register a pool owned by alice (feeBps = 20 = 0.20%)
        vm.prank(alice);
        poolId = registry.register_pool(
            address(0x1), address(0x2),
            address(0x3), "appswap-1", 20
        );

        // Fund router with tokens; router approves distributor to pull fees
        token.transfer(router, 100e18);
        vm.prank(router);
        token.approve(address(distributor), type(uint256).max);
    }

    function test_distribute_fee_split_small() public {
        // grossFee = 1000, feeBps = 20, TOTAL_FEE_BPS = 25
        // rollupFee   = 1000 * 20 / 25 = 800  (80% — rollup's share)
        // protocolFee = 1000 - 800      = 200  (20% — protocol's share, no dust)
        vm.prank(router);
        distributor.distribute(poolId, address(token), 1000);

        assertEq(distributor.pendingFees(address(token), alice),    800);
        assertEq(distributor.pendingFees(address(token), treasury), 200);
        assertEq(token.balanceOf(address(distributor)), 1000);
    }

    function test_distribute_no_dust_loss() public {
        uint256 grossFee = 1_000_000;
        vm.prank(router);
        distributor.distribute(poolId, address(token), grossFee);

        uint256 rollupPending   = distributor.pendingFees(address(token), alice);
        uint256 treasuryPending = distributor.pendingFees(address(token), treasury);

        // rollupFee = 1_000_000 * 20 / 25 = 800_000
        assertEq(rollupPending, 800_000);
        // protocolFee = 1_000_000 - 800_000 = 200_000
        assertEq(treasuryPending, 200_000);
        // Full fee accounted for — zero dust
        assertEq(rollupPending + treasuryPending, grossFee);
    }

    function test_cumulative_dust_free() public {
        // 1000 small swaps of grossFee=1 each — all must be accounted for
        uint256 rounds = 1000;
        for (uint256 i = 0; i < rounds; i++) {
            vm.prank(router);
            distributor.distribute(poolId, address(token), 1);
        }
        uint256 rollup   = distributor.pendingFees(address(token), alice);
        uint256 protocol = distributor.pendingFees(address(token), treasury);
        assertEq(rollup + protocol, rounds, "dust leak detected");
        assertEq(token.balanceOf(address(distributor)), rounds);
    }

    function test_claim() public {
        uint256 grossFee = 1_000_000;
        vm.prank(router);
        distributor.distribute(poolId, address(token), grossFee);
        // distribute() pulls tokens from router into distributor — no manual transfer needed

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        distributor.claim(address(token));
        // rollupFee = 1_000_000 * 20 / 25 = 800_000
        assertEq(token.balanceOf(alice), before + 800_000);
        assertEq(distributor.pendingFees(address(token), alice), 0);
    }

    function test_claim_nothing() public {
        vm.prank(alice);
        vm.expectRevert("nothing to claim");
        distributor.claim(address(token));
    }

    function test_claim_multiple() public {
        vm.prank(router);
        distributor.distribute(poolId, address(token), 1_000_000);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        uint256 before = token.balanceOf(treasury);
        vm.prank(treasury);
        distributor.claimMultiple(tokens);
        assertGt(token.balanceOf(treasury), before);
    }

    function test_only_router_can_distribute() public {
        vm.prank(alice);
        vm.expectRevert("not router");
        distributor.distribute(poolId, address(token), 100);
    }

    function test_registry_not_set_reverts() public {
        FeeDistributor bare = new FeeDistributor(owner, treasury);
        bare.setRouter(router);

        vm.prank(router);
        vm.expectRevert("registry not set");
        bare.distribute(poolId, address(token), 100);
    }
}
