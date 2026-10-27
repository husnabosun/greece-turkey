import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera, ChevronDown, History, ImageIcon, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScanMode } from '@/data/mock';
import { HINT, MODE_LABEL } from '@/lib/diagnosis';
import { useStore } from '@/state/store';

const MODES: ScanMode[] = ['leaf', 'fruit', 'trap', 'label'];
const isMode = (v: unknown): v is ScanMode => typeof v === 'string' && (MODES as string[]).includes(v);

export function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ fieldId?: string; treeId?: string; mode?: string }>();
  const fields = useStore((s) => s.fields);
  const trees = useStore((s) => s.trees);
  const setDarkChrome = useStore((s) => s.setDarkChrome);
  const setCaptureUri = useStore((s) => s.setCaptureUri);
  const selectField = useStore((s) => s.selectField);

  const [mode, setModeState] = useState<ScanMode>(isMode(params.mode) ? params.mode : 'leaf');
  const [fieldId, setFieldId] = useState(params.fieldId && fields.some((f) => f.id === params.fieldId) ? params.fieldId : fields[0].id);
  const [treeId, setTreeId] = useState<number | undefined>(params.treeId ? Number(params.treeId) : undefined);
  const [picking, setPicking] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [camFailed, setCamFailed] = useState(false);
  const camera = useRef<CameraView>(null);

  const field = fields.find((f) => f.id === fieldId) ?? fields[0];
  const cameraOn = permission?.granted === true && !camFailed;

  useEffect(() => {
    setDarkChrome(true);
    return () => setDarkChrome(false);
  }, [setDarkChrome]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission().catch(() => setCamFailed(true));
  }, [permission, requestPermission]);

  /** Label mode leaves the camera and opens Add spray with the label scan. */
  const openLabelFlow = () => {
    selectField(fieldId);
    router.replace({ pathname: '/logbook', params: { add: '1', label: '1' } });
  };

  useEffect(() => {
    if (params.mode === 'label') openLabelFlow();
    // Only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = (m: ScanMode) => (m === 'label' ? openLabelFlow() : setModeState(m));

  const analyse = (uri: string | null) => {
    setCaptureUri(uri);
    router.replace({
      pathname: '/scan/analysing',
      params: { mode, fieldId, ...(treeId ? { treeId: String(treeId) } : {}) },
    });
  };

  const shutter = async () => {
    if (!cameraOn) return analyse(null);
    try {
      const pic = await camera.current?.takePictureAsync({ quality: 0.5 });
      analyse(pic?.uri ?? null);
    } catch {
      analyse(null);
    }
  };

  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
      if (!res.canceled) analyse(res.assets[0].uri);
    } catch {
      analyse(null);
    }
  };

  const fieldTrees = (trees[fieldId] ?? []).slice().sort((a, b) => Number(b.status === 'diseased') - Number(a.status === 'diseased')).slice(0, 8);

  return (
    <View className="flex-1 bg-[#0B0B0B]" style={{ paddingTop: insets.top + 6 }}>
      <StatusBar style="light" />

      <View className="flex-row items-center justify-between px-4">
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" className="h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <X size={20} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setPicking((v) => !v)} accessibilityRole="button" className="h-9 flex-row items-center gap-1.5 rounded-full bg-white/15 px-3.5">
          <Text className="font-i7 text-ap-body text-white">{`${field.name}${treeId ? ` · Tree #${treeId}` : ''}`}</Text>
          <ChevronDown size={14} color="#fff" />
        </Pressable>
        <View className="h-10 w-10" />
      </View>

      <View className="mx-auto mt-3 h-9 flex-row rounded-full bg-white/15 p-1">
        {MODES.map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" className={`w-[72px] items-center justify-center rounded-full ${m === mode ? 'bg-white' : ''}`}>
            <Text className={`font-i7 text-ap-pill ${m === mode ? 'text-ink' : 'text-white/80'}`}>{MODE_LABEL[m]}</Text>
          </Pressable>
        ))}
      </View>

      <View className="mx-4 mt-3 flex-1 overflow-hidden rounded-[24px] bg-[#1B1B1B]">
        {cameraOn ? (
          <CameraView ref={camera} facing="back" style={{ flex: 1 }} onMountError={() => setCamFailed(true)} />
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Camera size={32} color="#8A8A8A" />
            <Text className="text-center font-i6 text-ap-body text-white/70">The camera is not available. You can still scan a photo.</Text>
            <Pressable onPress={pickPhoto} accessibilityRole="button" className="h-11 items-center justify-center rounded-full bg-white px-6">
              <Text className="font-i7 text-ap-btn text-ink">Choose a photo</Text>
            </Pressable>
            <Pressable onPress={() => analyse(null)} accessibilityRole="link" className="h-8 justify-center">
              <Text className="font-i6 text-ap-body text-white/70 underline">Use sample photo</Text>
            </Pressable>
          </View>
        )}
        {cameraOn ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="h-[230px] w-[230px] rounded-[24px] border-2 border-dashed border-white/80" />
          </View>
        ) : null}
        <Text pointerEvents="none" className="absolute bottom-4 self-center rounded-full bg-black/50 px-3 py-1.5 font-i6 text-ap-body text-white">{HINT[mode]}</Text>
      </View>

      <View className="flex-row items-center justify-between px-8" style={{ paddingTop: 14, paddingBottom: insets.bottom + 14 }}>
        <Pressable onPress={pickPhoto} accessibilityLabel="Choose a photo from your gallery" className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
          <ImageIcon size={22} color="#fff" />
        </Pressable>
        <Pressable onPress={shutter} accessibilityRole="button" accessibilityLabel="Take photo" className="h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white">
          <View className="h-[58px] w-[58px] rounded-full bg-white" />
        </Pressable>
        <Pressable onPress={() => router.navigate('/scan')} accessibilityLabel="Your scans" className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
          <History size={22} color="#fff" />
        </Pressable>
      </View>

      {picking ? (
        <View className="absolute inset-0 z-20">
          <Pressable onPress={() => setPicking(false)} className="absolute inset-0 bg-black/50" />
          <View className="absolute left-4 right-4 rounded-[18px] bg-card p-3" style={{ top: insets.top + 56 }}>
            <Text className="mb-1.5 font-i7 text-ap-small uppercase tracking-[1px] text-muted">Field</Text>
            <View className="flex-row flex-wrap gap-2">
              {fields.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setFieldId(f.id);
                    setTreeId(undefined);
                  }}
                  className={`h-[30px] flex-row items-center gap-1.5 rounded-full border px-3 ${f.id === fieldId ? 'border-primary bg-primary' : 'border-line bg-card'}`}
                >
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <Text className={`font-i7 text-ap-pill ${f.id === fieldId ? 'text-white' : 'text-ink'}`}>{f.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="mb-1.5 mt-3 font-i7 text-ap-small uppercase tracking-[1px] text-muted">Tree</Text>
            <View className="flex-row flex-wrap gap-2">
              <Pressable onPress={() => { setTreeId(undefined); setPicking(false); }} className={`h-[30px] items-center justify-center rounded-full border px-3 ${!treeId ? 'border-ink bg-ink' : 'border-line bg-card'}`}>
                <Text className={`font-i7 text-ap-pill ${!treeId ? 'text-white' : 'text-ink'}`}>Whole field</Text>
              </Pressable>
              {fieldTrees.map((t) => (
                <Pressable key={t.id} onPress={() => { setTreeId(t.id); setPicking(false); }} className={`h-[30px] items-center justify-center rounded-full border px-3 ${t.id === treeId ? 'border-ink bg-ink' : 'border-line bg-card'}`}>
                  <Text className={`font-i7 text-ap-pill ${t.id === treeId ? 'text-white' : 'text-ink'}`}>{`Tree #${t.id}`}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
