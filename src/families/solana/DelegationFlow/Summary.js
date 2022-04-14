/* @flow */
import {
  getAccountCurrency,
  getAccountName,
  getAccountUnit,
} from "@ledgerhq/live-common/lib/account";
import useBridgeTransaction from "@ledgerhq/live-common/lib/bridge/useBridgeTransaction";
import { getCurrencyColor } from "@ledgerhq/live-common/lib/currencies";
import { useLedgerFirstShuffledValidators } from "@ledgerhq/live-common/lib/families/solana/react";
import type { AccountLike } from "@ledgerhq/live-common/lib/types";
import type {
  SolanaStakeWithMeta,
  TransactionModel,
  Transaction,
} from "@ledgerhq/live-common/lib/families/solana/types";
import type { ValidatorsAppValidator } from "@ledgerhq/live-common/lib/families/solana/validator-app";
import { assertUnreachable } from "@ledgerhq/live-common/lib/families/solana/utils";
import { useTheme } from "@react-navigation/native";
import invariant from "invariant";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Trans } from "react-i18next";
import { Animated, StyleSheet, View } from "react-native";
import SafeAreaView from "react-native-safe-area-view";
import Icon from "react-native-vector-icons/dist/Feather";
import { useSelector } from "react-redux";
import { TrackScreen } from "../../../analytics";
import { rgba } from "../../../colors";
import Alert from "../../../components/Alert";
import Button from "../../../components/Button";
import Circle from "../../../components/Circle";
import CurrencyIcon from "../../../components/CurrencyIcon";
import CurrencyUnitValue from "../../../components/CurrencyUnitValue";
import LText from "../../../components/LText";
import Touchable from "../../../components/Touchable";
import { ScreenName } from "../../../const";
import { useTransactionChangeFromNavigation } from "../../../logic/screenTransactionHooks";
import { accountScreenSelector } from "../../../reducers/accounts";
import DelegatingContainer from "../../tezos/DelegatingContainer";
import ValidatorImage from "../shared/ValidatorImage";
import { BigNumber } from "bignumber.js";

const forceInset = { bottom: "always" };

type Props = {
  navigation: any,
  route: { params: RouteParams },
};

type RouteParams = {
  delegationAction?: DelegationAction,
  transaction?: Transaction,
  accountId: string,
  parentId?: string,
};

type DelegationAction =
  | {
      kind: "new",
    }
  | {
      kind: "change",
      stakeWithMeta: SolanaStakeWithMeta,
      stakeAction: StakeAction,
    };

const AccountBalanceTag = ({ account }: { account: AccountLike }) => {
  const unit = getAccountUnit(account);
  const { colors } = useTheme();
  return (
    <View
      style={[styles.accountBalanceTag, { backgroundColor: colors.lightFog }]}
    >
      <LText
        semiBold
        numberOfLines={1}
        style={styles.accountBalanceTagText}
        color="smoke"
      >
        <CurrencyUnitValue showCode unit={unit} value={account.balance} />
      </LText>
    </View>
  );
};

const ChangeDelegator = () => {
  const { colors } = useTheme();
  return (
    <Circle style={styles.changeDelegator} bg={colors.live} size={26}>
      <Icon size={13} name="edit-2" color={colors.white} />
    </Circle>
  );
};

const Line = ({ children }: { children: React$Node }) => (
  <View style={styles.summaryLine}>{children}</View>
);

const Words = ({
  children,
  highlighted,
  style,
}: {
  children: React$Node,
  highlighted?: boolean,
  style?: any,
}) => (
  <LText
    numberOfLines={1}
    semiBold={!highlighted}
    bold={highlighted}
    style={[styles.summaryWords, style]}
    color={highlighted ? "live" : "smoke"}
  >
    {children}
  </LText>
);

const BakerSelection = ({
  name,
  readOnly,
}: {
  name: string,
  readOnly?: boolean,
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.bakerSelection,
        { backgroundColor: rgba(colors.live, 0.2) },
      ]}
    >
      <LText
        bold
        numberOfLines={1}
        style={styles.bakerSelectionText}
        color="live"
      >
        {name}
      </LText>
      {readOnly ? null : (
        <View
          style={[styles.bakerSelectionIcon, { backgroundColor: colors.live }]}
        >
          <Icon size={16} name="edit-2" color={colors.white} />
        </View>
      )}
    </View>
  );
};

export default function DelegationSummary({ navigation, route }: Props) {
  const { delegationAction, transaction: routeTransaction } = route.params;

  invariant(delegationAction, "delegation action must be defined");

  const { colors } = useTheme();
  const { account, parentAccount } = useSelector(accountScreenSelector(route));

  invariant(account, "account must be defined");

  const validators = useLedgerFirstShuffledValidators(account.currency);

  const {
    transaction,
    setTransaction,
    status,
    bridgePending,
    bridgeError,
  } = useBridgeTransaction(() => {
    return {
      account,
      parentAccount,
      transaction: routeTransaction ?? {
        family: "solana",
        // TODO: fix amount
        amount: new BigNumber(1),
        model: txModelByDelegationAction(delegationAction, validators[0]),
      },
    };
  });

  invariant(transaction, "transaction must be defined");
  invariant(transaction.family === "solana", "transaction solana");

  const chosenValidator = useMemo(() => {
    if (delegationAction.kind === "new") {
      const { model } = transaction;
      invariant(
        model.kind === "stake.createAccount",
        "must be stake.createAccount tx model",
      );
      return validators.find(
        v => v.voteAccount === model.uiState.delegate.voteAccAddress,
      );
    }

    const { stake, meta } = delegationAction.stakeWithMeta;

    invariant(stake.delegation, "delegation must be defined");

    return validators.find(v => v.voteAccount === stake.delegation.voteAccAddr);
  }, [validators, transaction, delegationAction]);

  //invariant(chosenValidator, "validator must be defined");

  // make sure tx is in sync
  useEffect(() => {
    //if (!transaction || !account) return;
    //invariant(transaction.family === "solana", "solana tx");
    // make sure the mode is in sync (an account changes can reset it)
    /*
    const patch: Object = {
      mode: route.params?.mode ?? "delegate",
    };

    // make sure that in delegate mode, a transaction recipient is set (random pick)
    if (patch.mode === "delegate" && !transaction.recipient && randomBaker) {
      patch.recipient = randomBaker.address;
    }

    // when changes, we set again
    if (patch.mode !== transaction.mode || "recipient" in patch) {
      setTransaction(
        getAccountBridge(account, parentAccount).updateTransaction(
          transaction,
          patch,
        ),
      );
    }
    */
  }, [
    account,
    navigation,
    parentAccount,
    setTransaction,
    transaction,
    route.params,
  ]);

  const [rotateAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ]),
    ).start();
    return () => {
      rotateAnim.setValue(0);
    };
  }, [rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    // $FlowFixMe
    outputRange: ["0deg", "30deg"],
  });

  const onChangeDelegator = useCallback(() => {
    rotateAnim.setValue(0);
    navigation.navigate(ScreenName.DelegationSelectValidator, {
      ...route.params,
      transaction,
    });
  }, [rotateAnim, navigation, transaction, route.params]);

  //const delegation = useDelegation(account);
  //const addr = "test address";
  /*
    transaction.mode === "undelegate"
      ? (delegation && delegation.address) || ""
      : transaction.recipient;
  */
  //const bakerName = "test backer name"; // baker ? baker.name : shortAddressPreview(addr);
  const currency = getAccountCurrency(account);
  const color = getCurrencyColor(currency);
  const accountName = getAccountName(account);

  // handle any edit screen changes
  useTransactionChangeFromNavigation(setTransaction);

  const onContinue = useCallback(async () => {
    navigation.navigate(ScreenName.DelegationSelectDevice, {
      accountId: account.id,
      parentId: parentAccount && parentAccount.id,
      transaction,
      status,
    });
  }, [status, account, parentAccount, navigation, transaction]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      forceInset={forceInset}
    >
      <TrackScreen category="DelegationFlow" name="Summary" />

      <View style={styles.body}>
        <DelegatingContainer
          undelegation={undelegation(delegationAction)}
          left={
            <View style={styles.delegatingAccount}>
              <Circle size={64} bg={rgba(color, 0.2)}>
                <CurrencyIcon size={32} currency={currency} />
              </Circle>
              <AccountBalanceTag account={account} />
            </View>
          }
          right={
            supportValidatorChange(delegationAction) ? (
              <Touchable
                event="DelegationFlowSummaryChangeCircleBtn"
                onPress={onChangeDelegator}
              >
                <Circle
                  size={70}
                  style={[styles.bakerCircle, { borderColor: colors.grey }]}
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate,
                        },
                      ],
                    }}
                  >
                    <ValidatorImage validator={chosenValidator} />
                  </Animated.View>
                  <ChangeDelegator />
                </Circle>
              </Touchable>
            ) : (
              <ValidatorImage validator={chosenValidator} />
            )
          }
        />

        <View style={styles.summary}>
          <SummaryWords delegationAction={delegationAction} account={account} />
        </View>
        {transaction.mode === "undelegate" ? (
          <Alert type="help">
            <Trans i18nKey="delegation.warnUndelegation" />
          </Alert>
        ) : (
          <Alert type="help">
            <Trans i18nKey="delegation.warnDelegation" />
          </Alert>
        )}
      </View>
      <View style={styles.footer}>
        <Button
          event="SummaryContinue"
          type="primary"
          title={<Trans i18nKey="common.continue" />}
          containerStyle={styles.continueButton}
          onPress={onContinue}
          disabled={bridgePending || !!bridgeError}
          pending={bridgePending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "column",
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "space-around",
  },
  bakerCircle: {
    borderWidth: 1,
    borderStyle: "dashed",
  },
  changeDelegator: {
    position: "absolute",
    right: -4,
    top: -4,
  },
  delegatingAccount: {
    paddingTop: 26,
  },
  accountBalanceTag: {
    marginTop: 8,
    borderRadius: 4,
    padding: 4,
    alignItems: "center",
  },
  accountBalanceTagText: {
    fontSize: 11,
  },
  accountName: {
    maxWidth: 180,
  },
  summary: {
    alignItems: "center",
    marginVertical: 30,
  },
  summaryLine: {
    marginVertical: 10,
    flexDirection: "row",
    height: 40,
    alignItems: "center",
  },
  summaryWords: {
    marginRight: 6,
    fontSize: 18,
  },
  bakerSelection: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    height: 40,
  },
  bakerSelectionText: {
    paddingHorizontal: 8,
    fontSize: 18,
    maxWidth: 240,
  },
  bakerSelectionIcon: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 40,
  },
  footer: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  continueButton: {
    alignSelf: "stretch",
    marginTop: 12,
  },
});

// TODO: export stake actions type from live-common (or better move them to types)
type StakeAction = "deactivate" | "activate" | "withdraw" | "reactivate";

function txModelByDelegationAction(
  delegationAction: DelegationAction,
  voteAccAddrForNewAction: ValidatorsAppValidator,
): TransactionModel {
  if (delegationAction.kind === "new") {
    return {
      kind: "stake.createAccount",
      uiState: {
        delegate: {
          voteAccAddress: voteAccAddrForNewAction.voteAccount,
        },
      },
    };
  }

  const {
    stakeAction,
    stakeWithMeta: { stake, meta },
  } = delegationAction;

  invariant(stake.delegation, "stake delegation must be defined");

  const { stakeAccAddr, voteAccAddr } = stake;

  switch (stakeAction) {
    case "activate":
    case "reactivate":
      return {
        kind: "stake.delegate",
        uiState: {
          stakeAccAddr,
          voteAccAddr,
        },
      };
    case "deactivate":
      return {
        kind: "stake.undelegate",
        uiState: {
          stakeAccAddr,
        },
      };
    case "withdraw":
      return {
        kind: "stake.withdraw",
        uiState: {
          stakeAccAddr,
        },
      };
    default:
      assertUnreachable(stakeAction);
  }
}

function supportValidatorChange(delegationAction: DelegationAction) {
  return (
    delegationAction.kind === "new" ||
    delegationAction.stakeAction === "activate"
  );
}

function undelegation(delegationAction: DelegationAction) {
  if (delegationAction.kind === "new") {
    return false;
  }
  const { stakeAction } = delegationAction;
  return stakeAction === "deactivate" || stakeAction === "withdraw";
}

function SummaryWords({
  delegationAction,
  account,
}: {
  delegationAction: DelegationAction,
  account: AccountLike,
}) {
  /*
  const accountName = getAccountName(account);
  if (delegationAction.kind === "new") {
    return (
      <>
        <Line>
          <Words>
            delegate from
          </Words>
          <Words highlighted style={styles.accountName}>
            {accountName}
          </Words>
        </Line>
            <Line>
              <Words>
                <Trans i18nKey="delegation.from" />
              </Words>
              <BakerSelection
                readOnly
                name={chosenValidator?.name ?? chosenValidator?.voteAccount}
              />
            </Line>
      </>
    );
  }
    */
  return <LText>Some wording here</LText>;
}