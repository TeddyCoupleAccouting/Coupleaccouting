
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import { supabase } from "./supabase";
import Auth from "./Auth";

type Space = "household" | "personal";
type Tab = "Home" | "Activity" | "Reports" | "My Finance" | "Settings";
type TransactionType = "expense" | "income";

type Transaction = {
    id: string | number;
  name: string;
  category: string;
  amount: number;
  type: TransactionType;
  space: Space;
  date: string;
  icon: string;
  paidByUserId?: string;
splitMethod?: string | null;
shares?: { userId: string; amount: number }[];
balanceMessage?: string;
};

type HouseholdMember = {
  user_id: string;
  display_name: string;
};



const money = (amount: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(amount);

export default function App() {


const [showAllRepayments, setShowAllRepayments] = useState(false);
const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
const [session, setSession] = useState<Session | null>(null);
const [displayName, setDisplayName] = useState("");
const [profileMessage, setProfileMessage] = useState("");

    useEffect(() => {
    if (!session) {
      setHouseholdMembers([]);
      return;
    }

    let cancelled = false;

    async function loadHouseholdMembers() {
      const { data: membership, error: membershipError } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", session!.user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError || !membership) {
        if (membershipError) {
          console.error("Failed to load household:", membershipError.message);
        }
        return;
      }

      const { data: members, error: membersError } = await supabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", membership.household_id);

      if (membersError) {
        console.error("Failed to load members:", membersError.message);
        return;
      }

      const userIds = (members ?? []).map((member) => member.user_id);

      if (userIds.length === 0) {
        if (!cancelled) setHouseholdMembers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      if (profilesError) {
        console.error("Failed to load profiles:", profilesError.message);
      }

      const names = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.display_name,
        ])
      );

      const loadedMembers = userIds.map((userId) => ({
        user_id: userId,
        display_name: names.get(userId) || "Household member",
      }));

      if (!cancelled) {
        setHouseholdMembers(loadedMembers);
      }
    }

    void loadHouseholdMembers();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Session check failed:", error.message);
      return;
    }

    setSession(data.session);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

    return () => subscription.unsubscribe();
}, []);


async function handleSaveProfile() {
  if (!session?.user) {
    setProfileMessage("Please sign in again.");
    return;
  }

  const trimmedName = displayName.trim();

  if (!trimmedName) {
    setProfileMessage("Please enter a display name.");
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmedName })
    .eq("id", session.user.id);

  if (error) {
    console.error("Failed to save profile:", error.message);
    setProfileMessage("Couldn't save your profile. Please try again.");
    return;
  }

  setDisplayName(trimmedName);
  setProfileMessage("Profile saved successfully!");
}

async function handleSignOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign out failed:", error.message);
  }
}
  const [tab, setTab] = useState<Tab>("Home");
  
  const [space, setSpace] = useState<Space>("household");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

const [comparisonMonth, setComparisonMonth] = useState(() => {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
});

  const [sharedBalance, setSharedBalance] = useState(0);
  useEffect(() => {
  async function loadMyProfile() {
    if (!session?.user) {
      setDisplayName("");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load my profile:", error.message);
      return;
    }

    setDisplayName(data?.display_name ?? "");
  }

  void loadMyProfile();
}, [session]);

type Settlement = {
  id: string;
  household_id: string;
  paid_by: string;
  paid_to: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  settled_on: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
};

const [settlements, setSettlements] = useState<Settlement[]>([]);
const [showRepaymentForm, setShowRepaymentForm] = useState(false);
const [repaymentAmount, setRepaymentAmount] = useState("");
const [repaymentPaidBy, setRepaymentPaidBy] = useState("");
const [repaymentPaidTo, setRepaymentPaidTo] = useState("");
const [repaymentDate, setRepaymentDate] = useState(
  new Date().toISOString().slice(0, 10)
);
const [repaymentNote, setRepaymentNote] = useState("");
const [repaymentError, setRepaymentError] = useState("");
const [repaymentSaving, setRepaymentSaving] = useState(false);

const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>({});
  const [splitMethod, setSplitMethod] = useState<
  "equal" | "custom" | "percentage" | "shares" | "adjustment"
  >("equal");

  useEffect(() => {
    if (!session) {
      setTransactions([]);
      return;
    }

    let cancelled = false;

    async function loadTransactions() {
      if (!session) return;
      const { data, error } = await supabase
        .from("transactions")
        .select(
        "id, scope, kind, amount, description, occurred_on, category_id, paid_by, split_method"
        )
        .order("occurred_on", { ascending: false });

      if (error) {
        console.error("Failed to load transactions:", error.message);
        return;
      }

      const { data: categories, error: categoryError } = await supabase
        .from("categories")
        .select("id, name");

      if (categoryError) {
        console.error("Failed to load categories:", categoryError.message);
      }

      const categoryNames = new Map(
        (categories ?? []).map((item) => [item.id, item.name])
      );

      const loaded: Transaction[] = (data ?? []).map((item) => ({
        id: item.id,
        name: item.description,
        category: item.category_id
          ? categoryNames.get(item.category_id) ?? "Other Expenses"
          : "Other Expenses",
        amount: Number(item.amount),
        type: item.kind,
        space: item.scope === "shared" ? "household" : "personal",
        date: item.occurred_on,
        icon: item.kind === "income" ? "💰" : "🧾",
        paidByUserId: item.paid_by,
        splitMethod: item.split_method,
      }));


const { data: splits, error: splitsError } = await supabase
  .from("transaction_splits")
  .select("transaction_id, user_id, share_amount");

if (splitsError) {
  console.error("Failed to load transaction splits:", splitsError.message);
}

let loadedSettlements: Settlement[] = [];

const { data: membership, error: membershipError } = await supabase
  .from("household_members")
  .select("household_id")
  .eq("user_id", session.user.id)
  .limit(1)
  .maybeSingle();

if (membershipError) {
  console.error("Failed to load household membership:", membershipError.message);
} else if (membership?.household_id) {
  const { data: settlementData, error: settlementError } = await supabase
    .from("settlements")
    .select(
      "id, household_id, paid_by, paid_to, amount, status, settled_on, note, created_by, created_at"
    )
    .eq("household_id", membership.household_id)
    .order("created_at", { ascending: false });

  if (settlementError) {
    console.error("Failed to load settlements:", settlementError.message);
  } else {
    loadedSettlements = (settlementData ?? []) as Settlement[];
  }
}

for (const split of splits ?? []) {
  const transaction = loaded.find(
    (item) => String(item.id) === String(split.transaction_id)
  );

  if (!transaction) continue;

  transaction.shares ??= [];
  transaction.shares.push({
    userId: split.user_id,
    amount: Number(split.share_amount),
  });
}

const transactionById = new Map(
  (data ?? []).map((item) => [item.id, item])
);

let balance = 0;

for (const split of splits ?? []) {
  const transaction = transactionById.get(split.transaction_id);

  if (
    !transaction ||
    transaction.scope !== "shared" ||
    transaction.kind !== "expense"
  ) {
    continue;
  }

  if (
  transaction.paid_by === session?.user.id &&
  split.user_id !== session?.user.id
) {
  balance += Number(split.share_amount);
} else if (
  transaction.paid_by !== session?.user.id &&
  split.user_id === session?.user.id
) {
  balance -= Number(split.share_amount);
  }
}

for (const settlement of loadedSettlements) {
  if (settlement.status !== "completed") continue;

  if (settlement.paid_by === session.user.id) {
    balance += Number(settlement.amount);
  } else if (settlement.paid_to === session.user.id) {
    balance -= Number(settlement.amount);
  }
}
      if (!cancelled) {
  setSharedBalance(balance);
  setTransactions(loaded)
  setSettlements(loadedSettlements);
    }
    }

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const personal = space === "personal";
  const visibleTransactions = transactions.filter(
    (item) => item.space === space
  );

  const filteredTransactions = visibleTransactions.filter((item) =>
    `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalIncome = visibleTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpenses = visibleTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
    const now = new Date();
const currentMonth =
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;


const householdMonthlyTransactions = transactions.filter(
  (item) =>
    item.space === "household" &&
    item.date.slice(0, 7) === currentMonth
);

const householdMonthlyIncome = householdMonthlyTransactions
  .filter((item) => item.type === "income")
  .reduce((sum, item) => sum + item.amount, 0);

const householdMonthlyExpenses = householdMonthlyTransactions
  .filter((item) => item.type === "expense")
  .reduce((sum, item) => sum + item.amount, 0);

const householdMonthlyDifference =
  householdMonthlyIncome - householdMonthlyExpenses;


const selectedMonthDate = new Date(
  Number(comparisonMonth.slice(0, 4)),
  Number(comparisonMonth.slice(5, 7)) - 1,
  1
);

const selectedMonth =
  `${selectedMonthDate.getFullYear()}-${String(
    selectedMonthDate.getMonth() + 1
  ).padStart(2, "0")}`;

const previousMonthDate = new Date(
  selectedMonthDate.getFullYear(),
  selectedMonthDate.getMonth() - 1,
  1
);

const previousMonth =
  `${previousMonthDate.getFullYear()}-${String(
    previousMonthDate.getMonth() + 1
  ).padStart(2, "0")}`;

const householdPreviousMonthTransactions = transactions.filter(
  (item) =>
    item.space === "household" &&
    item.date.slice(0, 7) === previousMonth
);

const householdPreviousMonthIncome =
  householdPreviousMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

const householdPreviousMonthExpenses =
  householdPreviousMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

const householdSelectedMonthTransactions = transactions.filter(
  (item) =>
    item.space === "household" &&
    item.date.slice(0, 7) === selectedMonth
);

const householdSelectedMonthIncome =
  householdSelectedMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

const householdSelectedMonthExpenses =
  householdSelectedMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

const householdIncomeChange =
  householdSelectedMonthIncome - householdPreviousMonthIncome;

const householdExpensesChange =
  householdSelectedMonthExpenses - householdPreviousMonthExpenses;

const currentMonthLabel = selectedMonthDate.toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
});

const previousMonthLabel = previousMonthDate.toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
});

const householdCategoryTotals = householdMonthlyTransactions
  .filter((item) => item.type === "expense")
  .reduce<Record<string, number>>((totals, item) => {
    totals[item.category] =
      (totals[item.category] ?? 0) + item.amount;
    return totals;
  }, {});

const householdCategoryEntries = Object.entries(
  householdCategoryTotals
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

const highestCategoryAmount =
  householdCategoryEntries[0]?.[1] ?? 0;


  function openAdd() {
    setKind("expense");
    setName("");
    setAmount("");
    setCategory("Food");
    setNote("");
    setShowAdd(true);
  }

  
  async function saveTransaction(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSaveError("");

    if (!session) {
      setSaveError("Please sign in again before saving.");
      return;
    }

    const value = Number(amount);

    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      setSaveError("Please enter a name and a valid amount.");
      return;
    }
let calculatedSharesToSave: {
  user_id: string;
  share_amount: number;
}[] = [];

if (space === "household" && kind === "expense") {
  if (
    !paidBy ||
    !householdMembers.some((member) => member.user_id === paidBy)
  ) {
    setSaveError("Please choose who paid for this expense.");
    return;
  }

  

const totalCents = Math.round(value * 100);

const enteredValues = householdMembers.map((member) => ({
  user_id: member.user_id,
  raw: shareAmounts[member.user_id] ?? "",
  amount: Number(shareAmounts[member.user_id]),
}));

let shares: {
  user_id: string;
  share_amount: number;
  entered_amount: string;
}[] = [];

if (splitMethod === "equal") {
  const baseCents = Math.floor(totalCents / householdMembers.length);
  const remainder = totalCents % householdMembers.length;

  shares = householdMembers.map((member, index) => ({
    user_id: member.user_id,
    share_amount:
      (baseCents + (index < remainder ? 1 : 0)) / 100,
    entered_amount: "",
  }));
} else {
  if (
    enteredValues.some(
      (item) =>
        item.raw.trim() === "" ||
        !Number.isFinite(item.amount)
    )
  ) {
    setSaveError("Please enter a valid value for each household member.");
    return;
  }

  if (splitMethod === "custom") {
    if (enteredValues.some((item) => item.amount < 0)) {
      setSaveError("Share amounts cannot be negative.");
      return;
    }

    shares = enteredValues.map((item) => ({
      user_id: item.user_id,
      share_amount: Math.round(item.amount * 100) / 100,
      entered_amount: item.raw,
    }));
  } else if (splitMethod === "percentage") {
    if (
      enteredValues.some((item) => item.amount < 0 || item.amount > 100) ||
      Math.abs(
        enteredValues.reduce((sum, item) => sum + item.amount, 0) - 100
      ) > 0.01
    ) {
      setSaveError("Percentages must add up to 100%.");
      return;
    }

    const calculated = enteredValues.map((item) =>
      Math.round((totalCents * item.amount) / 100)
    );
    const difference =
      totalCents - calculated.reduce((sum, cents) => sum + cents, 0);

    calculated[calculated.length - 1] += difference;

    shares = enteredValues.map((item, index) => ({
      user_id: item.user_id,
      share_amount: calculated[index] / 100,
      entered_amount: item.raw,
    }));
  } else if (splitMethod === "shares") {
    if (
      enteredValues.some((item) => item.amount < 0) ||
      enteredValues.reduce((sum, item) => sum + item.amount, 0) <= 0
    ) {
      setSaveError("Share units must be non-negative, with at least one share above zero.");
      return;
    }

    const totalUnits = enteredValues.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const calculated = enteredValues.map((item) =>
      Math.round((totalCents * item.amount) / totalUnits)
    );
    const difference =
      totalCents - calculated.reduce((sum, cents) => sum + cents, 0);

    calculated[calculated.length - 1] += difference;

    shares = enteredValues.map((item, index) => ({
      user_id: item.user_id,
      share_amount: calculated[index] / 100,
      entered_amount: item.raw,
    }));
  } else {
    const adjustments = enteredValues.map((item) =>
      Math.round(item.amount * 100)
    );
    const adjustmentTotal = adjustments.reduce(
      (sum, cents) => sum + cents,
      0
    );

    if (Math.abs(adjustmentTotal) > 1) {
      setSaveError("Adjustments must add up to ฿0.");
      return;
    }

    const baseCents = Math.floor(totalCents / householdMembers.length);
    const remainder = totalCents % householdMembers.length;

    const calculated = householdMembers.map((_, index) =>
      baseCents +
      (index < remainder ? 1 : 0) +
      adjustments[index]
    );

    if (calculated.some((cents) => cents < 0)) {
      setSaveError("An adjustment cannot make a person's share negative.");
      return;
    }

    shares = enteredValues.map((item, index) => ({
      user_id: item.user_id,
      share_amount: calculated[index] / 100,
      entered_amount: item.raw,
    }));
  }
}


const sharesTotal = shares.reduce(
  (total, share) => total + Math.round(share.share_amount * 100),
  0
);

if (Math.abs(sharesTotal - totalCents) > 1) {
  setSaveError("Each person's shares must add up to the total expense.");
  return;
}

calculatedSharesToSave = shares.map((share) => ({
  user_id: share.user_id,
  share_amount: share.share_amount,
}));

}

    setSaving(true);

    try {
      let householdId: string | null = null;

      if (space === "household") {
        const { data: membership, error: membershipError } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", session!.user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) throw membershipError;

        if (!membership?.household_id) {
          throw new Error(
            "No household membership was found. Your transaction has not been saved."
          );
        }

        householdId = membership.household_id;
      }

      const categoryNames: Record<string, string> = {
  Food: "Food & Groceries",
  Groceries: "Food & Groceries",
  Housing: "Rent",
  Bills: "Utilities",
  Transport: "Transportation",
  Health: "Healthcare",
  Other: "Other Expenses",
  Salary: "Salary",
  Freelance: "Freelance",
  "Business income": "Other Income",
  "Other income": "Other Income",
};

      const databaseCategoryName = categoryNames[category] ?? category;

      const { data: categoryRow, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("name", databaseCategoryName)
        .eq("kind", kind)
        .limit(1)
        .maybeSingle();

      if (categoryError) throw categoryError;

      if (!categoryRow) {
        throw new Error(
          `The category "${databaseCategoryName}" isn't available to your account. No transaction was saved.`
        );
      }

      const now = new Date();
      const occurredOn = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      const { data: saved, error: saveErrorFromDb } = await supabase
        .from("transactions")
        .insert({
          household_id: householdId,
          created_by: session.user.id,
          paid_by:
    space === "household" && kind === "expense"
    ? paidBy
    : session.user.id,
          scope: space === "household" ? "shared" : "private",
          kind,
          category_id: categoryRow.id,
          amount: value,
          description: name.trim(),
          occurred_on: occurredOn,
          split_method:
    space === "household" && kind === "expense"
          ? splitMethod
          : null,
    notes: note.trim() || null,
        })
        .select(
          "id, scope, kind, amount, description, occurred_on, category_id, paid_by, split_method"
        )
        .single();

      if (saveErrorFromDb) throw saveErrorFromDb;

if (space === "household" && kind === "expense") {
  
const splitsToSave = calculatedSharesToSave.map((share) => ({
  transaction_id: saved.id,
  user_id: share.user_id,
  share_amount: share.share_amount,
}));

const { error: splitError } = await supabase
  .from("transaction_splits")
  .insert(splitsToSave);

if (splitError) {
  throw new Error(
    `Transaction was saved, but saving the shares failed: ${splitError.message}`
  );
}
}

      const newTransaction: Transaction = {
        id: saved.id,
        name: saved.description,
        category: databaseCategoryName,
        amount: Number(saved.amount),
        type: saved.kind,
        space: saved.scope === "shared" ? "household" : "personal",
        date: saved.occurred_on,
        icon: saved.kind === "income" ? "💰" : "🧾",
      };

      setTransactions((current) => [newTransaction, ...current]);
      setShowAdd(false);
      setTab(space === "personal" ? "My Finance" : "Activity");
    } catch (error) {
      console.error("Failed to save transaction:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }



async function handleSaveRepayment() {
  if (!session) return;

  const value = Number(repaymentAmount);

  if (!Number.isFinite(value) || value <= 0) {
    setRepaymentError("Please enter an amount greater than zero.");
    return;
  }

  if (!repaymentPaidBy || !repaymentPaidTo) {
    setRepaymentError("Please choose who paid and who received the money.");
    return;
  }

  if (repaymentPaidBy === repaymentPaidTo) {
    setRepaymentError("The payer and receiver must be different people.");
    return;
  }

  setRepaymentSaving(true);
  setRepaymentError("");

  try {
    const { data: membership, error: membershipError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership?.household_id) {
      throw new Error("No household membership was found.");
    }

    const { data: saved, error } = await supabase
      .from("settlements")
      .insert({
        household_id: membership.household_id,
        paid_by: repaymentPaidBy,
        paid_to: repaymentPaidTo,
        amount: value,
        status: "completed",
        settled_on: repaymentDate,
        note: repaymentNote.trim() || null,
        created_by: session.user.id,
            })
      .select(
        "id, household_id, paid_by, paid_to, amount, status, settled_on, note, created_by, created_at"
      )
      .single();
      

    if (error) throw error;

    setSettlements((current) => [saved as Settlement, ...current]);

setSharedBalance((current) =>
  repaymentPaidBy === session.user.id
    ? current + value
    : current - value
);

    setRepaymentAmount("");
    setRepaymentNote("");
    setShowRepaymentForm(false);
    setRepaymentPaidBy("");
    setRepaymentPaidTo("");
  } catch (error) {
    console.error("Failed to save repayment:", error);
    setRepaymentError(
      error instanceof Error
        ? error.message
        : "Could not save the repayment. Please try again."
    );
  } finally {
    setRepaymentSaving(false);
  }
}

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    if (nextTab === "My Finance") setSpace("personal");
    if (nextTab === "Home" || nextTab === "Activity" || nextTab === "Reports") {
      setSpace("household");
    }
  }

  if (!session) {
  return <Auth />;
}

return (
  <div className={`app ${personal ? "personal-theme" : "household-theme"}`}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">♡</span>
          <span>together<span className="brand-dot">.</span></span>
        </a>

        <p className="nav-caption">YOUR SPACE</p>
        <nav className="side-nav">
          {(["Home", "Activity", "Reports", "My Finance"] as Tab[]).map(
            (item) => (
              <button
                key={item}
                className={`nav-item ${tab === item ? "active" : ""}`}
                onClick={() => changeTab(item)}
              >
                <span className="nav-icon">
              {({
                  Home: "⌂",
                  Activity: "↗",
                  Reports: "▥",
                  "My Finance": "♡",
                  Settings: "⚙️",
                } as Record<Tab, string>)[item]}
          </span>
                {item}
                {item === "My Finance" && <span className="private-dot">●</span>}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="mini-couple">
            <div className="avatar avatar-one">🐻</div>
            <div className="avatar avatar-two">🐰</div>
            <div>
              <strong>Our little team</strong>
              <span>Making progress together</span>
            </div>
          </div>
          <button
  className={`settings-button ${tab === "Settings" ? "active" : ""}`}
  onClick={() => setTab("Settings")}
>
  ⚙️ &nbsp; Settings
</button>
          <button className="settings-button" onClick={handleSignOut}>
  ↪ &nbsp; Log out
        </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">♡</span> together.
          </div>
          <div className="breadcrumb">
            <span>YOUR FINANCES</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{personal ? "My Personal Finance" : "Household Finance"}</strong>
          </div>
          <button className="profile-button" title="Your profile">🐻</button>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                {personal ? "YOUR OWN LITTLE CORNER 🌷" : "YOUR LIFE, TOGETHER 💜"}
              </div>
              <h1>
                {personal ? "Your money, your way." : "Together, one little step at a time."}
              </h1>
              <p className="welcome-description">
                {personal
                  ? "A private space for your goals, plans, and peace of mind."
                  : "A little more clarity, a little less money stress."}
              </p>
            </div>
            <button className="primary-button desktop-add" onClick={openAdd}>
              <span>＋</span> Add transaction
            </button>
          </div>

          <div className="space-switcher" aria-label="Finance space">
            <button
              className={!personal ? "selected household-option" : ""}
              onClick={() => {
                setSpace("household");
                setTab("Home");
              }}
            >
              💜 Household Finance
            </button>
            <button
              className={personal ? "selected personal-option" : ""}
              onClick={() => {
                setSpace("personal");
                setTab("My Finance");
              }}
            >
              🌷 My Personal Finance <span className="lock-label">PRIVATE</span>
            </button>
          </div>

          {tab === "Home" && !personal && (
            <>
              <section className="couple-banner">
                <div className="couple-copy">
                  <span className="banner-kicker">OUR LITTLE MONEY CHECK-IN</span>
                  <h2>Teamwork looks good on you. 💕</h2>
                  <p>Every small step helps build the life you want together.</p>
                </div>
                <div className="couple-avatars">
                  <div className="big-avatar bear">🐻</div>
                  <span className="heart-between">♥</span>
                  <div className="big-avatar bunny">🐰</div>
                </div>
                <span className="banner-decoration decoration-one">✦</span>
                <span className="banner-decoration decoration-two">♡</span>
              </section>

            
<div className="household-balance-layout">
  <section
    className="panel household-members-card"
    style={{ marginBottom: "0", padding: "0.4rem 0.7rem" }}
  >
  
<div className="panel-heading">
  <div className="household-members-heading">
    <span className="balance-icon">♧</span>
    <div>
      <span className="card-label">YOUR HOUSEHOLD</span>
      <h2>Household members</h2>
    </div>
  </div>
</div>

  {householdMembers.length > 0 ? (
    <div>
      {householdMembers.map((member) => (
        <div
          key={member.user_id}
          style={{ padding: "0.5rem 0" }}
        >
          👤 {member.display_name}
        </div>
      ))}
    </div>
  ) : (
    <p>No household members found yet.</p>
  )}
</section>

              <section className="balance-card">
                <div className="balance-heading">
                  <span className="balance-icon">♡</span>
                  <div>
                    <span className="card-label">WHO OWES WHOM?</span>
                    <h2>
  {sharedBalance > 0
    ? "Your partner owes you"
    : sharedBalance < 0
      ? "You owe your partner"
      : "You're all settled!"}
</h2>
                  </div>
                  
                </div>
                <div className="balance-main">
                  <div>
                    <div className="balance-amount">{money(sharedBalance)}</div>
                    <p className="balance-subtitle">
  {sharedBalance > 0
    ? "Your partner needs to pay you back. 💕"
    : sharedBalance < 0
      ? "You need to pay your partner back. 💕"
      : "Keep being a great team. 💕"}
      </p>
                  </div>
                  <div className="balance-illustration">🫶</div>
                </div>
                <button className="text-link" onClick={() => setTab("Activity")}>
                  View expense ledger <span>→</span>
                </button>
              </section>
              </div>
              


              <section className="summary-grid">
                <article className="summary-card">
                  <div className="summary-top">
                    <span className="summary-icon income-icon">↗</span>
                    <span className="summary-caption">THIS MONTH</span>
                  </div>
                  <p>Total income</p>
                  <h3>{money(householdMonthlyIncome)}</h3>
                  <span className="summary-foot">Household income</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top">
                    <span className="summary-icon expense-icon">↘</span>
                    <span className="summary-caption">THIS MONTH</span>
                  </div>
                  <p>Total expenses</p>
                  <h3>{money(householdMonthlyExpenses)}</h3>
                  <span className="summary-foot">Shared spending</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top">
                    <span className="summary-icon difference-icon">♡</span>
                    <span className="summary-caption">THIS MONTH</span>
                  </div>
                  <p>Income minus expenses</p>
                  <h3>{money(householdMonthlyDifference)}</h3>
                  <span className="summary-foot">Household difference</span>
                </article>
              </section>

              <section className="content-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">A LITTLE OVERVIEW</span>
                      <h2>Spending by category</h2>
                    </div>
                    <button className="subtle-button" onClick={() => setTab("Reports")}>See reports →</button>
                  </div>
                  
{householdCategoryEntries.length > 0 ? (
  <div className="category-breakdown">
    {householdCategoryEntries.map(([categoryName, amount]) => (
      <div className="category-row" key={categoryName}>
        <div className="category-row-top">
          <span>{categoryName}</span>
          <strong>{money(amount)}</strong>
        </div>

        <div className="category-bar">
          <div
            className="category-bar-fill"
            style={{
              width: `${
                highestCategoryAmount > 0
                  ? (amount / highestCategoryAmount) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    ))}
  </div>
) : (
  <div className="empty-chart">
    <div className="empty-chart-icon">🌱</div>
    <strong>Your story starts here</strong>
    <span>
      Add household expenses to see your spending breakdown.
    </span>
  </div>
  
)}

                </article>

                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">LITTLE MONEY MOMENTS</span>
                      <h2>Recent activity</h2>
                    </div>
                    <button className="subtle-button" onClick={() => setTab("Activity")}>View all →</button>
                  </div>
                  <TransactionList
                  items={visibleTransactions.slice(0, 3)}
                  householdMembers={householdMembers}
                  currentUserId={session?.user.id ?? ""}
/>
                </article>
              </section>
              <section className="panel repayment-panel">
  <div className="panel-heading">
    <div>
      <span className="card-label">HOUSEHOLD FINANCES</span>
      <h2>Repayments 💕</h2>
    </div>
    <button
      className="text-link"
      onClick={() => {
        setShowRepaymentForm((current) => !current);
        setRepaymentError("");
      }}
    >
      {showRepaymentForm ? "Cancel" : "+ Record repayment"}
    </button>
  </div>

  {showRepaymentForm && (
    <div className="repayment-form">
      <label>
        Amount (฿)
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={repaymentAmount}
          onChange={(event) => setRepaymentAmount(event.target.value)}
          placeholder="e.g. 200"
        />
      </label>

      
<label>
  Paid by
  <select
    value={repaymentPaidBy}
    onChange={(event) => {
      setRepaymentPaidBy(event.target.value);
      if (event.target.value === repaymentPaidTo) {
        setRepaymentPaidTo("");
      }
    }}
  >
    <option value="">Choose who paid</option>
    {householdMembers.map((member) => (
      <option key={member.user_id} value={member.user_id}>
        {member.display_name}
      </option>
    ))}
  </select>
</label>

<label>
  Paid to
  <select
    value={repaymentPaidTo}
    onChange={(event) => setRepaymentPaidTo(event.target.value)}
  >
    <option value="">Choose who received the money</option>
    {householdMembers
      .filter((member) => member.user_id !== repaymentPaidBy)
      .map((member) => (
        <option key={member.user_id} value={member.user_id}>
          {member.display_name}
        </option>
      ))}
  </select>
</label>

      <label>
        Payment date
        <input
          type="date"
          value={repaymentDate}
          onChange={(event) => setRepaymentDate(event.target.value)}
        />
      </label>

      <label>
        Note (optional)
        <input
          type="text"
          value={repaymentNote}
          onChange={(event) => setRepaymentNote(event.target.value)}
          placeholder="e.g. Paid back for groceries"
        />
      </label>

      {repaymentError && (
        <p role="alert" className="error-message">
          {repaymentError}
        </p>
      )}

      <button
        className="primary-button"
        onClick={handleSaveRepayment}
        disabled={repaymentSaving}
      >
        {repaymentSaving ? "Saving..." : "Save repayment"}
      </button>
    </div>
  )}

  <div className="repayment-history">
    <h3>Repayment history</h3>

    {settlements.length === 0 ? (
      <p>No repayments recorded yet.</p>
    ) : (
      settlements
  .slice(0, showAllRepayments ? settlements.length : 5)
  .map((settlement) => {
        const payer = householdMembers.find(
          (member) => member.user_id === settlement.paid_by
        );
        const receiver = householdMembers.find(
          (member) => member.user_id === settlement.paid_to
        );

        return (
          <div key={settlement.id} className="repayment-item">
            <div>
              <strong>
                {payer?.display_name ?? "Household member"} →{" "}
                {receiver?.display_name ?? "Household member"}
              </strong>
              <p>
                {settlement.settled_on ?? "Date not specified"}
                {settlement.note ? ` · ${settlement.note}` : ""}
              </p>
              <small>{settlement.status}</small>
            </div>
            <strong>{money(Number(settlement.amount))}</strong>
          </div>
        );
      })
    )}

{settlements.length > 5 && (
  <button
    type="button"
    className="text-link repayment-view-all"
    onClick={() => setShowAllRepayments((current) => !current)}
  >
    {showAllRepayments ? "Show less ↑" : "View all repayments →"}
  </button>
)}

  </div>
</section>

<section className="panel month-comparison redesigned-month-comparison">
  <div className="month-comparison-heading">
    <div>
      <p className="eyebrow">MONTHLY COMPARISON</p>
      <h2>{currentMonthLabel} vs {previousMonthLabel}</h2>
    </div>
    <input
    type="month"
    value={comparisonMonth}
    onChange={(event) => setComparisonMonth(event.target.value)}
  />
  </div>

  <div className="month-comparison-grid">
    <article className="month-comparison-item income-comparison">
      <div className="comparison-item-heading">
        <span className="comparison-icon">↗</span>
        <span>Income change</span>
      </div>
      <strong className="comparison-amount">
        {householdIncomeChange > 0 ? "+" : householdIncomeChange < 0 ? "−" : ""}
        {money(Math.abs(householdIncomeChange))}
      </strong>
      <p>
        {householdPreviousMonthIncome > 0
          ? `${householdIncomeChange > 0 ? "+" : ""}${(
              (householdIncomeChange / householdPreviousMonthIncome) * 100
            ).toFixed(1)}% compared with last month`
          : "No previous-month income to compare"}
      </p>
    </article>

    <article className="month-comparison-item expense-comparison">
      <div className="comparison-item-heading">
        <span className="comparison-icon">↘</span>
        <span>Expense change</span>
      </div>
      <strong className="comparison-amount">
        {householdExpensesChange > 0 ? "+" : householdExpensesChange < 0 ? "−" : ""}
        {money(Math.abs(householdExpensesChange))}
      </strong>
      <p>
        {householdPreviousMonthExpenses > 0
          ? `${householdExpensesChange > 0 ? "+" : ""}${(
              (householdExpensesChange / householdPreviousMonthExpenses) * 100
            ).toFixed(1)}% compared with last month`
          : "No previous-month expenses to compare"}
      </p>
    </article>
  </div>
</section>
            </>
          )}

          {tab !== "Settings" && (tab === "My Finance" || personal) && (
            <>
              <section className="personal-hero">
                <div>
                  <span className="banner-kicker">JUST FOR YOU 🌷</span>
                  <h2>A fresh start, at your own pace.</h2>
                  <p>Your money, your choices, your private space.</p>
                </div>
                <div className="personal-flower">🌷</div>
              </section>

              <section className="summary-grid personal-summaries">
                <article className="summary-card">
                  <div className="summary-top"><span className="summary-icon income-icon">↗</span><span className="summary-caption">THIS MONTH</span></div>
                  <p>Personal income</p>
                  <h3>{money(totalIncome)}</h3>
                  <span className="summary-foot">Money coming in</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top"><span className="summary-icon expense-icon">↘</span><span className="summary-caption">THIS MONTH</span></div>
                  <p>Personal expenses</p>
                  <h3>{money(totalExpenses)}</h3>
                  <span className="summary-foot">Money going out</span>
                </article>
                <article className="summary-card">
                  <div className="summary-top"><span className="summary-icon difference-icon">♡</span><span className="summary-caption">THIS MONTH</span></div>
                  <p>Income minus expenses</p>
                  <h3>{money(totalIncome - totalExpenses)}</h3>
                  <span className="summary-foot">Your monthly difference</span>
                </article>
              </section>

              <section className="content-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">YOUR FINANCIAL JOURNEY</span><h2>My savings goals</h2></div>
                    <span className="panel-emoji">🌱</span>
                  </div>
                  <div className="empty-chart">
                    <div className="empty-chart-icon">🐣</div>
                    <strong>Every little bit counts</strong>
                    <span>Create a private savings goal when you're ready.</span>
                  </div>
                </article>
                <article className="panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">JUST YOURS</span><h2>Recent transactions</h2></div>
                    <button className="subtle-button" onClick={() => setTab("Activity")}>View all →</button>
                  </div>
                  <TransactionList items={visibleTransactions.slice(0, 4)} />
                </article>
              </section>
            </>
          )}

          {tab === "Settings" && (
            <section className="settings-page">
              <div className="panel">
                <span className="section-kicker">YOUR ACCOUNT</span>
                <h2>Settings ⚙️</h2>
                <p className="welcome-description">
                  Manage your account and make this little space feel like yours.
                </p>
              </div>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">PROFILE</span>
                    <h2>My profile</h2>
                  </div>
                  <span className="panel-emoji">🌷</span>
                </div>
                <p className="welcome-description">
                  Your account is connected to your Couple Finance login.
                </p>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">PREFERENCES</span>
                    <h2>App preferences</h2>
                  </div>
                  <span className="panel-emoji">💜</span>
                </div>
                <div className="settings-option">
                  <div>
                    <strong>Currency</strong>
                    
  <div className="profile-details">
  <div className="settings-option">
  <div className="profile-name-field">
    <strong>Display name</strong>
    <input
      type="text"
      value={displayName}
      onChange={(event) => {
        setDisplayName(event.target.value);
        setProfileMessage("");
      }}
      placeholder="Enter your display name"
    />
  </div>
</div>
<div className="profile-actions">
  <button
    className="primary-button"
    onClick={() => void handleSaveProfile()}
  >
    Save profile
  </button>

  {profileMessage && (
    <p className="welcome-description" role="status">
      {profileMessage}
    </p>
  )}
</div>

  <div className="settings-option">
    <div>
      <strong>Email address</strong>
      <p className="welcome-description">
        {session?.user?.email || "No email available"}
      </p>
    </div>
  </div>
</div>
                  </div>
                  <span className="settings-value">THB (฿)</span>
                </div>
                <div className="settings-option">
                  <div>
                    <strong>Personal finance privacy</strong>
                    <p className="welcome-description">
                      Your personal records should remain private to your account.
                    </p>
                  </div>
                  <span className="settings-value">🔒 Private</span>
                </div>
              </section>
            </section>
          )}


          {tab === "Activity" && (
            <section className="panel activity-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">YOUR MONEY, IN MOTION</span><h2>{personal ? "My transactions" : "Household activity"}</h2></div>
                <span className="activity-count">{filteredTransactions.length} records</span>
              </div>
              <input
                className="search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transactions..."
                aria-label="Search transactions"
              />
              <TransactionList items={filteredTransactions} />
              {filteredTransactions.length === 0 && <p className="empty-message">No matching transactions yet.</p>}
            </section>
          )}

          {tab === "Reports" && (
            <section className="panel reports-panel">
              <span className="section-kicker">YOUR MONTH, AT A GLANCE</span>
              <h2>{personal ? "My personal report" : "Our household report"}</h2>
              <p className="welcome-description">Your monthly charts and detailed comparisons will appear here as you add transactions.</p>
              <div className="empty-chart">
                <div className="empty-chart-icon">📊</div>
                <strong>A clearer picture starts with a little data</strong>
                <span>Category breakdowns, budget progress, and monthly comparisons will live here.</span>
              </div>
            </section>
          )}
        </div>
      </main>

      <nav className="mobile-nav">
        {(["Home", "Activity", "Reports", "My Finance"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => changeTab(item)}>
            <span>
        {{
               Home: "⌂",
               Activity: "↗",
               Reports: "▥",
               "My Finance": "♡",
               Settings: "⚙️",
         }[item]}
</span>
            <small>{item}</small>
          </button>
        ))}
      </nav>

      <button className="floating-add" onClick={openAdd} aria-label="Add transaction">＋</button>

      {showAdd && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowAdd(false);
        }}>
          <section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-heading">
              <div>
                <span className="section-kicker">A LITTLE MONEY UPDATE</span>
                <h2 id="add-title">Add a transaction</h2>
              </div>
              <button className="close-button" onClick={() => setShowAdd(false)} aria-label="Close">×</button>
            </div>

            <div className="space-choice">
              <button className={space === "household" ? "selected" : ""} onClick={() => { setSpace("household"); setTab("Home"); }}>💜 Household</button>
              <button className={space === "personal" ? "selected" : ""} onClick={() => { setSpace("personal"); setTab("My Finance"); }}>🌷 Personal · Private</button>
            </div>

            <form onSubmit={saveTransaction}>
              <div className="type-switch">
                <button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => { setKind("expense"); setCategory("Food"); }}>− Expense</button>
                <button type="button" className={kind === "income" ? "selected" : ""} onClick={() => { setKind("income"); setCategory("Salary"); }}>＋ Income</button>
              </div>

              <label className="form-label" htmlFor="transaction-name">Transaction name</label>
              <input id="transaction-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Lunch, salary, groceries" required />

              <label className="form-label" htmlFor="transaction-amount">Amount (THB)</label>
              <div className="amount-input-wrap"><span>฿</span><input id="transaction-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></div>

{space === "household" && kind === "expense" && (
  <div className="household-split-fields">
    <label className="form-label" htmlFor="transaction-payer">
      Who paid?
    </label>
    <select
      id="transaction-payer"
      value={paidBy}
      onChange={(event) => setPaidBy(event.target.value)}
      required
    >
      <option value="">Choose who paid</option>
      {householdMembers.map((member) => (
        <option key={member.user_id} value={member.user_id}>
          {member.display_name}
        </option>
      ))}
    </select>

<label className="form-label" htmlFor="split-method">
  How should we split it?
</label>

<select
  value={splitMethod}
  onChange={(event) =>
    setSplitMethod(
      event.target.value as
        | "equal"
        | "custom"
        | "percentage"
        | "shares"
        | "adjustment"
    )
  }
>
  <option value="equal">Split equally</option>
  <option value="custom">Split by exact amounts</option>
  <option value="percentage">Split by percentages</option>
  <option value="shares">Split by shares</option>
  <option value="adjustment">Split by adjustment</option>
</select>

    
{splitMethod === "equal" ? (
  <p className="form-hint">
    The expense will be divided equally between all household members.
  </p>
) : (
  <>
    <label className="form-label">
      {splitMethod === "custom"
        ? "Each person's share (THB)"
        : splitMethod === "percentage"
          ? "Each person's percentage (%)"
          : splitMethod === "shares"
            ? "Share units for each person"
            : "Adjustment for each person (THB)"}
    </label>

    {householdMembers.map((member) => (
      <div key={member.user_id}>
        <label
          className="form-label"
          htmlFor={`share-${member.user_id}`}
        >
          {member.display_name}
        </label>

        <div className="amount-input-wrap">
          <span>
            {splitMethod === "percentage"
              ? "%"
              : splitMethod === "shares"
                ? "×"
                : "฿"}
          </span>

          <input
            id={`share-${member.user_id}`}
            type="number"
            min={splitMethod === "adjustment" ? undefined : "0"}
            max={splitMethod === "percentage" ? "100" : undefined}
            step="0.01"
            value={shareAmounts[member.user_id] ?? ""}
            onChange={(event) =>
              setShareAmounts((current) => ({
                ...current,
                [member.user_id]: event.target.value,
              }))
            }
            placeholder={
              splitMethod === "percentage"
                ? "50"
                : splitMethod === "shares"
                  ? "1"
                  : "0.00"
            }
            required
          />
        </div>
      </div>
    ))}

    <p className="form-hint">
      {splitMethod === "custom"
        ? "All amounts must add up to the total expense."
        : splitMethod === "percentage"
          ? "All percentages must add up to 100%."
          : splitMethod === "shares"
            ? "Enter each person's share units. The expense will be divided proportionally."
            : "Start with an equal split. Positive adjustments increase a person's share; negative adjustments decrease it. All adjustments must add up to ฿0."}
    </p>
  </>
)}
  </div>
)}


              <label className="form-label" htmlFor="transaction-category">Category</label>
              <select id="transaction-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                {(kind === "expense"
                  ? ["Food", "Groceries", "Housing", "Bills", "Transport", "Shopping", "Health", "Other"]
                  : ["Salary", "Freelance", "Business income", "Other income"]
                ).map((item) => <option key={item}>{item}</option>)}
              </select>

              <details className="optional-details">
                <summary>＋ Optional details</summary>
                <label className="form-label" htmlFor="transaction-note">Note</label>
                <textarea id="transaction-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a little note..." rows={2} />
                <p className="form-hint">Dates and receipt uploads will be added in a later step.</p>
              </details>
{saveError && (
  <p className="auth-error" role="alert">{saveError}</p>
)}

<button
  className="primary-button save-button"
  type="submit"
  disabled={saving}
>
  {saving ? "Saving..." : "Save transaction ♡"}
</button>
              
              <p className="privacy-note">
  🔒 {space === "personal"
    ? "Private transactions are saved to your account."
    : "Household transactions are shared with household members."}
</p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function formatTransactionDate(date: string) {
  const parsedDate = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TransactionList({
  items,
  householdMembers = [],
  currentUserId = "",
}: {
  items: Transaction[];
  householdMembers?: HouseholdMember[];
  currentUserId?: string;
}) {
  
  if (items.length === 0) {
    return <div className="empty-list">No transactions yet. Add your first one when you're ready. 🌷</div>;
  }

  return (
    <div className="transaction-list">
      
{items.map((item) => {
  const isHouseholdExpense =
    item.space === "household" && item.type === "expense";

  const payer = householdMembers.find(
    (member) => member.user_id === item.paidByUserId
  );

  const myShare = item.shares?.find(
    (share) => share.userId === currentUserId
  );

  const partnerShare = item.shares?.find(
    (share) => share.userId !== currentUserId
  );

  const payerName =
    item.paidByUserId === currentUserId
      ? "you"
      : payer?.display_name ?? "your partner";

  let balanceMessage = "";

  if (myShare && partnerShare) {
    if (item.paidByUserId === currentUserId) {
      balanceMessage = `${partnerShare.userId === currentUserId ? "You" : householdMembers.find((m) => m.user_id === partnerShare.userId)?.display_name ?? "Your partner"} owes you ${money(partnerShare.amount)}`;
    
} else if (item.paidByUserId !== currentUserId) {
  balanceMessage = `You owe ${payerName} ${money(myShare.amount)}`;
}
 else {
      balanceMessage = "";
    }
  }

  return (
    <div className="transaction-row" key={item.id}>
      <div className="transaction-icon">{item.icon}</div>
      <div className="transaction-info">
        <strong>{item.name}</strong>
        <span>{item.category} · {formatTransactionDate(item.date)}</span>

        {isHouseholdExpense && (
          <div className="household-payment-details">
            <div>
              Paid by {payerName}
              {item.splitMethod && (
                <> · {({
                  equal: "Split equally",
                  custom: "Exact amounts",
                  percentage: "By percentage",
                  shares: "By shares",
                  adjustment: "Adjusted split",
                } as Record<string, string>)[item.splitMethod] ?? item.splitMethod}</>
              )}
            </div>

            {item.shares && item.shares.length > 0 && (
              <div>
                {item.shares.map((share) => {
                  const memberName =
                    share.userId === currentUserId
                      ? "You"
                      : householdMembers.find(
                          (member) => member.user_id === share.userId
                        )?.display_name ?? "Partner";

                  return `${memberName} ${money(share.amount)}`;
                }).join(" · ")}
              </div>
            )}

            {balanceMessage && (
              <div style={{ fontWeight: 600, marginTop: "2px" }}>
                {balanceMessage}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`transaction-amount ${item.type}`}>
        {item.type === "income" ? "+" : "−"}{money(item.amount)}
      </div>
    </div>
  );
})}
    </div>
  );
}
