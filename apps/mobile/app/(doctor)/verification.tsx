import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  getDoctorProfile,
  submitDoctorVerification,
  uploadDoctorDocument,
  type DoctorProfileDto,
} from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";

type DocKey = "pmdcCertificate" | "cnicFront" | "cnicBack" | "degreeCertificate";

const DOC_LABELS: Record<DocKey, string> = {
  pmdcCertificate: "PMDC certificate",
  cnicFront: "CNIC (front)",
  cnicBack: "CNIC (back)",
  degreeCertificate: "Degree certificate",
};

const STATUS_COPY: Record<string, { title: string; body: string; tone: "pending" | "approved" | "danger" }> = {
  pending: { title: "Pending review", body: "Your submission is being reviewed by our team.", tone: "pending" },
  approved: { title: "Approved", body: "You're verified and listed for patients to book.", tone: "approved" },
  rejected: { title: "Rejected", body: "Update your details and documents below, then resubmit.", tone: "danger" },
  restricted: { title: "Restricted", body: "Your account was restricted. Contact support for details.", tone: "danger" },
};

export default function DoctorVerificationScreen() {
  const [profile, setProfile] = useState<DoctorProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cnic, setCnic] = useState("");
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [uploadingKey, setUploadingKey] = useState<DocKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getDoctorProfile()
      .then((dto) => {
        setProfile(dto);
        setDocs({
          pmdcCertificate: dto.documents.pmdcCertificate,
          cnicFront: dto.documents.cnicFront,
          cnicBack: dto.documents.cnicBack,
          degreeCertificate: dto.documents.degreeCertificate,
        });
      })
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Failed to load profile"));
  }, []);

  const pickDoc = async (key: DocKey) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach documents.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (picked.canceled || !picked.assets[0]) return;

    setUploadingKey(key);
    try {
      const asset = picked.assets[0];
      const stored = await uploadDoctorDocument({
        uri: asset.uri,
        name: asset.fileName ?? `${key}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
      setDocs((prev) => ({ ...prev, [key]: stored.url }));
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again");
    } finally {
      setUploadingKey(null);
    }
  };

  const submit = async () => {
    if (!profile) return;
    if (!/^[0-9]{5}-[0-9]{7}-[0-9]$/.test(cnic)) {
      Alert.alert("Invalid CNIC", "Enter your CNIC as XXXXX-XXXXXXX-X.");
      return;
    }
    if (!profile.medicalDegree || !profile.medicalCollege || !profile.graduationYear) {
      Alert.alert(
        "Missing details",
        "Add your medical degree, college, and graduation year on the website before resubmitting.",
      );
      return;
    }
    if (!profile.user.avatarUrl) {
      Alert.alert("Profile photo required", "Add a profile photo on the website before resubmitting.");
      return;
    }
    if (!profile.hospitals.length || !profile.weeklyAvailability.length) {
      Alert.alert(
        "Missing details",
        "Add at least one practice location and weekly availability window on the website before resubmitting.",
      );
      return;
    }
    if (!docs.pmdcCertificate || !docs.cnicFront || !docs.cnicBack || !docs.degreeCertificate) {
      Alert.alert("Missing documents", "Upload all four documents before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await submitDoctorVerification({
        pmdcNumber: profile.pmdcNumber ?? "",
        cnic,
        medicalDegree: profile.medicalDegree,
        qualifications: profile.qualifications,
        medicalCollege: profile.medicalCollege,
        graduationYear: profile.graduationYear,
        experienceYears: profile.experienceYears,
        avatarUrl: profile.user.avatarUrl,
        bio: profile.bio,
        consultationFee: profile.consultationFee,
        hospitals: profile.hospitals,
        homeVisit: profile.homeVisit,
        documentUrls: docs as Record<DocKey, string>,
        weeklyAvailability: profile.weeklyAvailability,
        sundayConsult: profile.sundayConsult,
      });
      const refreshed = await getDoctorProfile();
      setProfile(refreshed);
      Alert.alert("Submitted", "Your verification has been resubmitted for review.");
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : "Failed to submit verification";
      setError(message);
      Alert.alert("Couldn't submit", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) {
    return error ? (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    ) : (
      <BrandLoadingScreen />
    );
  }

  const statusCopy = STATUS_COPY[profile.verificationStatus] ?? STATUS_COPY.pending;
  const toneColor = statusCopy.tone === "approved" ? "#16a34a" : statusCopy.tone === "danger" ? "#c62828" : "#F5A623";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.statusCard, { backgroundColor: `${toneColor}14` }]}>
        <Ionicons name="shield-checkmark" size={22} color={toneColor} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: toneColor }]}>{statusCopy.title}</Text>
          <Text style={styles.statusBody}>{statusCopy.body}</Text>
          {profile.rejectionReason ? <Text style={styles.rejectionReason}>“{profile.rejectionReason}”</Text> : null}
        </View>
      </View>

      {profile.verificationStatus !== "approved" ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CNIC</Text>
            <TextInput
              style={styles.input}
              value={cnic}
              onChangeText={setCnic}
              placeholder="XXXXX-XXXXXXX-X"
              placeholderTextColor="#9AA5B1"
              keyboardType="number-pad"
              accessibilityLabel="CNIC"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documents</Text>
            {(Object.keys(DOC_LABELS) as DocKey[]).map((key) => (
              <Pressable
                key={key}
                style={styles.docRow}
                onPress={() => pickDoc(key)}
                disabled={uploadingKey === key}
                accessibilityRole="button"
              >
                <Ionicons
                  name={docs[key] ? "checkmark-circle" : "cloud-upload-outline"}
                  size={20}
                  color={docs[key] ? "#16a34a" : colors.brand.DEFAULT}
                />
                <Text style={styles.docLabel}>{DOC_LABELS[key]}</Text>
                {uploadingKey === key ? (
                  <Spinner size="sm" />
                ) : (
                  <Text style={styles.docAction}>{docs[key] ? "Replace" : "Upload"}</Text>
                )}
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>
            Specialties, fee, bio, practice locations, and availability are pulled from your profile — edit those on
            the Profile tab or the website first if they need updating.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.submitButton} onPress={submit} disabled={isSubmitting} accessibilityRole="button">
            {isSubmitting ? (
              <Spinner size="sm" color={colors.brand.foreground} />
            ) : (
              <Text style={styles.submitButtonText}>Submit for verification</Text>
            )}
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: "#888", lineHeight: 18 },

  statusCard: { flexDirection: "row", gap: 12, borderRadius: 16, padding: 16 },
  statusTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  statusBody: { fontFamily: fonts.regular, fontSize: 12.5, color: "#555", marginTop: 2, lineHeight: 18 },
  rejectionReason: { fontFamily: fonts.regular, fontSize: 12.5, color: "#c62828", marginTop: 6, fontStyle: "italic" },

  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10, ...cardShadow },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },

  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  docLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.neutral.foreground },
  docAction: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.brand.DEFAULT },

  submitButton: { backgroundColor: colors.brand.DEFAULT, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
});
