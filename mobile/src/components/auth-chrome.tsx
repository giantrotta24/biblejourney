import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColors } from '@/theme/colors';
import { fonts, hitSize } from '@/theme/fonts';

import { DottedCut, Perforation } from './marks';

export function AuthSheet({ children }: { children: ReactNode }) {
  const colors = useColors();
  const android = Platform.OS === 'android';
  const body = (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Perforation color={colors.under} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 32 }}>
        {children}
      </ScrollView>
    </View>
  );
  if (!android) return body;
  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      {body}
    </KeyboardAvoidingView>
  );
}

export function SheetTitle({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole="header"
      style={{
        flex: 1,
        fontFamily: fonts.serifSemibold,
        fontSize: 22,
        lineHeight: 22 * 1.2,
        color: colors.ink,
      }}>
      {children}
    </Text>
  );
}

export function CancelButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  if (Platform.OS === 'android') return <CloseButton onPress={onPress} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      onPress={onPress}
      style={{ minHeight: hitSize(), justifyContent: 'center', paddingHorizontal: 2 }}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>Cancel</Text>
    </Pressable>
  );
}

export function CloseButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={onPress}
      style={{ minWidth: hitSize(), minHeight: hitSize(), alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.field,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M2 2l8 8M10 2l-8 8" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>
    </Pressable>
  );
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: hitSize(), flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Svg width={11} height={18} viewBox="0 0 11 18" fill="none">
        <Path d="M9 2 2 9l7 7" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={{ fontSize: 17, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Lead({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text style={{ fontSize: 16, lineHeight: 24, color: colors.ink2, marginTop: 6, marginBottom: 18 }}>{children}</Text>
  );
}

export function ErrorLine({ children, quiet = false }: { children: string; quiet?: boolean }) {
  const colors = useColors();
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(children);
  }, [children]);
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{
        color: quiet ? colors.ink2 : colors.danger,
        fontSize: quiet ? 15 : 14,
        lineHeight: quiet ? 21 : 20,
        marginBottom: 10,
      }}>
      {children}
    </Text>
  );
}

export function OrDivider() {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <DottedCut color={colors.ink3} />
      </View>
      <Text style={{ fontSize: 14, color: colors.ink2 }}>or</Text>
      <View style={{ flex: 1 }}>
        <DottedCut color={colors.ink3} />
      </View>
    </View>
  );
}

const buttonHeight = Platform.OS === 'android' ? 48 : 50;
const buttonSize = Platform.OS === 'android' ? 15 : 17;
const buttonWeight = Platform.OS === 'android' ? '500' : '600';

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: buttonHeight,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.blue,
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
        marginTop: 6,
      })}>
      <Text style={{ color: colors.onBlue, fontSize: buttonSize, fontWeight: buttonWeight }}>{label}</Text>
    </Pressable>
  );
}

export function InkButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: buttonHeight,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: colors.ink,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.paper,
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
      })}>
      <Text style={{ color: colors.ink, fontSize: buttonSize, fontWeight: buttonWeight }}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: hitSize(), alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}>
      <Text
        style={{
          fontSize: 16,
          color: disabled ? colors.ink3 : colors.ink,
          textDecorationLine: 'underline',
          textDecorationColor: colors.ink3,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoComplete,
  textContentType,
  bad = false,
  code = false,
  autoFocus = false,
  maxLength,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'email-address' | 'number-pad';
  autoComplete?: 'email' | 'one-time-code';
  textContentType?: 'emailAddress' | 'oneTimeCode';
  bad?: boolean;
  code?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  returnKeyType?: 'send' | 'go';
  onSubmitEditing?: () => void;
}) {
  const colors = useColors();
  const android = Platform.OS === 'android';
  const borderColor = bad ? colors.danger : android ? colors.ink2 : 'transparent';
  return (
    <View style={{ marginBottom: 10 }}>
      {android && !code ? (
        <Text
          style={{
            position: 'absolute',
            top: 0,
            left: 12,
            zIndex: 1,
            backgroundColor: colors.paper,
            paddingHorizontal: 4,
            fontSize: 12,
            color: bad ? colors.danger : colors.ink2,
          }}>
          {label}
        </Text>
      ) : (
        <Text style={{ fontSize: 14, color: colors.ink2, marginBottom: 6 }}>{label}</Text>
      )}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink2}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={{
          height: code ? 56 : android ? 56 : 48,
          marginTop: android && !code ? 8 : 0,
          borderRadius: android ? 4 : 10,
          borderWidth: bad ? 1.5 : android ? 1 : 1.5,
          borderColor,
          backgroundColor: android ? 'transparent' : colors.field,
          paddingHorizontal: code ? 8 : android ? 16 : 14,
          fontSize: code ? 30 : android ? 16 : 17,
          fontWeight: code ? '600' : '400',
          letterSpacing: code ? 9.6 : 0,
          textAlign: code ? 'center' : 'left',
          fontVariant: code ? ['tabular-nums'] : undefined,
          color: colors.ink,
        }}
      />
    </View>
  );
}
