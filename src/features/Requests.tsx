import { useAppDimensions } from "../hooks/useAppDimensions";
import { zodResolver } from "@hookform/resolvers/zod";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCheck,
  ClipboardList,
  FilePenLine,
  Palmtree,
  Paperclip,
  Plus,
  Send,
} from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Pressable, View } from "react-native";
import { z } from "zod";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  IconBox,
  Row,
  SectionTitle,
  Sheet,
  T,
} from "../components/ui";
import {
  correctionSchema,
  dateKey,
  leaveSchema,
  workingDays,
} from "../domain/attendance";
import { useData } from "../services/data";
import { repository, uid } from "../services/repository";
import { useTheme } from "../theme";
import type { WorkforceRequest } from "../types";
import { PageHeading } from "./Home";
export const requestTone = (status: string) =>
  status === "Approved"
    ? "green"
    : status === "Rejected"
      ? "red"
      : status === "Pending"
        ? "amber"
        : "neutral";
export default function Requests() {
  const c = useTheme();
  const { db, employee, refresh } = useData();
  const { width } = useAppDimensions();
  const params = useLocalSearchParams<{ new?: string }>();
  const router = useRouter();
  const [localForm, setLocalForm] = useState<
    "leave" | "correction" | undefined
  >();
  const form =
    params.new === "leave" || params.new === "correction"
      ? params.new
      : localForm;
  const setForm = (value: "leave" | "correction" | undefined) => {
    setLocalForm(value);
    if (params.new) router.setParams({ new: "" });
  };
  const [filter, setFilter] = useState("All requests");
  const [selected, setSelected] = useState<WorkforceRequest>();
  const [success, setSuccess] = useState(false);
  const requests = db.requests.filter((r) => r.employeeId === employee.id);
  const used = requests
    .filter(
      (r) =>
        r.kind === "leave" &&
        r.type === "Annual leave" &&
        r.status === "Approved",
    )
    .reduce((n, r) => n + (r.kind === "leave" ? r.days : 0), 0);
  const pending = requests.filter((r) => r.status === "Pending").length;
  const list = requests.filter(
    (r) => filter === "All requests" || r.status === filter,
  );
  return (
    <View style={{ gap: 22 }}>
      <View style={{ marginBottom: -22 }}>
        <PageHeading
          title="Room for life, too"
          subtitle="Time off, small corrections, and everything in between."
          right={
            <Button
              label="Request leave"
              icon={Plus}
              onPress={() => setForm("leave")}
            />
          }
        />
      </View>
      <View style={{ flexDirection: width >= 700 ? "row" : "column", gap: 16 }}>
        <Card
          style={{
            flex: width >= 700 ? 1 : undefined,
            backgroundColor: c.lavender,
            borderWidth: 0,
          }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <IconBox icon={Palmtree} bg={c.surface} />
            <Badge label="Annual leave" />
          </Row>
          <Row style={{ alignItems: "baseline", marginTop: 18 }}>
            <T size={40} weight="bold" color={c.primaryText}>
              {14 - used}
            </T>
            <T color={c.primaryText} size={12}>
              days remaining
            </T>
          </Row>
          <T size={11} color={c.muted}>
            {used} of 14 days used · Take a breather when you need one.
          </T>
        </Card>
        <Card style={{ flex: width >= 700 ? 1 : undefined }}>
          <IconBox icon={ClipboardList} bg={c.amberBg} color={c.amber} />
          <T size={36} weight="bold" style={{ marginTop: 15 }}>
            {pending}
          </T>
          <T size={12} color={c.muted}>
            Requests awaiting a little attention
          </T>
        </Card>
        <Card
          style={{
            flex: width >= 700 ? 1 : undefined,
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <IconBox icon={FilePenLine} />
          <View>
            <T size={15} weight="bold">
              Missed a moment?
            </T>
            <T size={11} color={c.muted} style={{ marginTop: 5 }}>
              Forgot to clock in or out? Let’s set the record straight.
            </T>
          </View>
          <Button
            small
            variant="secondary"
            label="Correct attendance"
            onPress={() => setForm("correction")}
          />
        </Card>
      </View>
      <Card>
        <SectionTitle
          title="Your requests"
          action={`${requests.length} total`}
        />
        <Row style={{ flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {["All requests", "Pending", "Approved", "Rejected", "Cancelled"].map(
            (v) => (
              <Button
                key={v}
                label={v}
                small
                variant={v === filter ? "primary" : "secondary"}
                onPress={() => setFilter(v)}
              />
            ),
          )}
        </Row>
        {list.length ? (
          list.map((r, i) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => setSelected(r)}
              style={{
                paddingVertical: 18,
                borderTopWidth: i ? 1 : 0,
                borderColor: c.border,
              }}
            >
              <Row style={{ gap: 13, flexWrap: "wrap" }}>
                <IconBox
                  icon={r.kind === "leave" ? Palmtree : FilePenLine}
                  size={41}
                />
                <View style={{ flex: 1, minWidth: 100 }}>
                  <T size={12} weight="bold">
                    {r.type}
                  </T>
                  <T size={10} color={c.muted} style={{ marginTop: 3 }}>
                    {r.kind === "leave"
                      ? `${r.start} → ${r.end} · ${r.days} days`
                      : `${r.date} · Requested ${r.time}`}
                  </T>
                </View>
                <Badge label={r.status} tone={requestTone(r.status)} />
              </Row>
            </Pressable>
          ))
        ) : (
          <Empty
            title="Nothing here just yet"
            message="Your requests will appear here as soon as you submit them."
          />
        )}
      </Card>
      <Sheet
        visible={!!form}
        title={
          form === "leave" ? "A little time for you" : "Let’s set it right"
        }
        onClose={() => setForm(undefined)}
      >
        {form === "leave" ? (
          <LeaveForm
            onDone={async () => {
              await refresh();
              setForm(undefined);
              setSuccess(true);
            }}
          />
        ) : form === "correction" ? (
          <CorrectionForm
            onDone={async () => {
              await refresh();
              setForm(undefined);
              setSuccess(true);
            }}
          />
        ) : null}
      </Sheet>
      <Sheet
        visible={success}
        title="Request sent"
        onClose={() => setSuccess(false)}
      >
        <View style={{ alignItems: "center", gap: 16, paddingVertical: 18 }}>
          <IconBox icon={CheckCheck} color={c.green} bg={c.greenBg} size={74} />
          <T size={22} weight="bold">
            You’re all set.
          </T>
          <T color={c.muted} style={{ textAlign: "center" }}>
            Your request is with the People team. We’ll keep you in the loop.
          </T>
        </View>
        <Button label="Back to requests" onPress={() => setSuccess(false)} />
      </Sheet>
      <Sheet
        visible={!!selected}
        title="Request details"
        onClose={() => setSelected(undefined)}
      >
        {selected && (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <T weight="bold">{selected.type}</T>
              <Badge
                label={selected.status}
                tone={requestTone(selected.status)}
              />
            </Row>
            <T color={c.muted}>
              {selected.kind === "leave"
                ? `${selected.start} to ${selected.end} · ${selected.days} working days`
                : `${selected.date} · ${selected.time}`}
            </T>
            <Card style={{ backgroundColor: c.bg, padding: 17 }}>
              <T size={12}>{selected.reason}</T>
            </Card>
            {selected.kind === "correction" && !!selected.attachment && (
              <T size={11} color={c.muted}>
                Supporting attachment: {selected.attachment} (demo filename
                only)
              </T>
            )}
            <T size={10} color={c.muted}>
              Submitted {new Date(selected.createdAt).toLocaleString("en-GB")}
            </T>
          </>
        )}
      </Sheet>
    </View>
  );
}
type LeaveValues = z.infer<typeof leaveSchema>;
function LeaveForm({ onDone }: { onDone: () => Promise<void> }) {
  const c = useTheme();
  const { employee } = useData();
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeaveValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      type: "Annual leave",
      start: dateKey(),
      end: dateKey(),
      reason: "",
    },
  });
  const values = useWatch({ control });
  return (
    <View style={{ gap: 17 }}>
      <T size={12} color={c.muted}>
        Make space for what matters. Your manager will review your request.
      </T>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <View style={{ gap: 8 }}>
            <T weight="semibold" size={12}>
              Leave type
            </T>
            <Row style={{ flexWrap: "wrap", gap: 7 }}>
              {[
                "Annual leave",
                "Sick leave",
                "Personal leave",
                "Unpaid leave",
              ].map((type) => (
                <Button
                  key={type}
                  small
                  label={type}
                  variant={field.value === type ? "primary" : "secondary"}
                  onPress={() => field.onChange(type)}
                />
              ))}
            </Row>
          </View>
        )}
      />
      <Row style={{ alignItems: "flex-start" }}>
        {(["start", "end"] as const).map((name) => (
          <View key={name} style={{ flex: 1 }}>
            <Controller
              control={control}
              name={name}
              render={({ field }) => (
                <Field
                  label={
                    name === "start" ? "From (YYYY-MM-DD)" : "To (YYYY-MM-DD)"
                  }
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="2026-11-02"
                  error={errors[name]?.message}
                  maxLength={10}
                />
              )}
            />
          </View>
        ))}
      </Row>
      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <Field
            label="A little context"
            placeholder="Tell your manager why you’re taking leave…"
            value={field.value}
            onChangeText={field.onChange}
            multiline
            style={{ minHeight: 100, textAlignVertical: "top" }}
            error={errors.reason?.message}
          />
        )}
      />
      {!!values.start && !!values.end && values.end >= values.start && (
        <Badge
          label={`${workingDays(values.start, values.end)} working days requested`}
          tone="blue"
        />
      )}
      {!!error && (
        <T color={c.red} size={11}>
          {error}
        </T>
      )}
      <Button
        label="Send leave request"
        icon={Send}
        loading={isSubmitting}
        onPress={handleSubmit(async (data) => {
          setError("");
          try {
            await repository.submitRequest({
              ...data,
              id: uid(),
              employeeId: employee.id,
              kind: "leave",
              days: workingDays(data.start, data.end),
              status: "Pending",
              createdAt: new Date().toISOString(),
            });
            await onDone();
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      />
    </View>
  );
}
type CorrectionValues = z.infer<typeof correctionSchema>;
function CorrectionForm({ onDone }: { onDone: () => Promise<void> }) {
  const c = useTheme();
  const { employee } = useData();
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState("");
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CorrectionValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      type: "Forgot to clock in",
      date: dateKey(),
      time: "09:00",
      reason: "",
    },
  });
  return (
    <View style={{ gap: 17 }}>
      <T size={12} color={c.muted}>
        Your original attendance stays on record. Corrections are reviewed by
        HR.
      </T>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <View style={{ gap: 8 }}>
            <T weight="semibold" size={12}>
              What happened?
            </T>
            <Row style={{ flexWrap: "wrap", gap: 7 }}>
              {[
                "Forgot to clock in",
                "Forgot to clock out",
                "Incorrect time",
                "Location issue",
              ].map((type) => (
                <Button
                  key={type}
                  small
                  label={type}
                  variant={field.value === type ? "primary" : "secondary"}
                  onPress={() => field.onChange(type)}
                />
              ))}
            </Row>
          </View>
        )}
      />
      {(["date", "time", "reason"] as const).map((name) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field }) => (
            <Field
              label={
                name === "date"
                  ? "Attendance date (YYYY-MM-DD)"
                  : name === "time"
                    ? "Requested time (24-hour HH:MM)"
                    : "What should we know?"
              }
              value={field.value}
              onChangeText={field.onChange}
              multiline={name === "reason"}
              style={
                name === "reason"
                  ? { minHeight: 90, textAlignVertical: "top" }
                  : undefined
              }
              error={errors[name]?.message}
            />
          )}
        />
      ))}
      <Button
        variant="secondary"
        label={attachment || "Add supporting attachment (optional)"}
        icon={Paperclip}
        onPress={async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({
              type: ["image/*", "application/pdf"],
              copyToCacheDirectory: false,
            });
            if (!result.canceled) setAttachment(result.assets[0].name);
          } catch {
            setError("Could not open the file picker. Please try again.");
          }
        }}
      />
      {!!attachment && (
        <T size={10} color={c.muted}>
          Demo stores the filename only. Files are not uploaded.
        </T>
      )}
      {!!error && (
        <T color={c.red} size={11}>
          {error}
        </T>
      )}
      <Button
        label="Send correction request"
        icon={Send}
        loading={isSubmitting}
        onPress={handleSubmit(async (data) => {
          setError("");
          try {
            await repository.submitRequest({
              ...data,
              id: uid(),
              employeeId: employee.id,
              kind: "correction",
              attachment: attachment || undefined,
              status: "Pending",
              createdAt: new Date().toISOString(),
            });
            await onDone();
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      />
    </View>
  );
}
