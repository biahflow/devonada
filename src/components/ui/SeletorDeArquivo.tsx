import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { ArquivoContrato } from '../../api/contratos';

type Origem = 'pdf' | 'camera' | 'galeria';

const OPCOES: { origem: Origem; label: string }[] = [
  { origem: 'pdf', label: 'Escolher PDF' },
  { origem: 'camera', label: 'Tirar foto' },
  { origem: 'galeria', label: 'Escolher da galeria' },
];

/**
 * Abre o menu nativo de origem e devolve o arquivo escolhido, ou null se o
 * usuário desistiu.
 *
 * Permissão de câmera é pedida NO CONTEXTO, ao escolher a câmera — nunca no
 * boot do app. Pedir permissão antes de existir motivo é o caminho mais curto
 * para o usuário negar.
 */
export async function escolherArquivo(): Promise<ArquivoContrato | null> {
  const origem = await perguntarOrigem();
  if (!origem) return null;

  if (origem === 'pdf') return escolherPdf();
  return escolherImagem(origem);
}

function perguntarOrigem(): Promise<Origem | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'De onde vem o contrato?',
          options: [...OPCOES.map((o) => o.label), 'Cancelar'],
          cancelButtonIndex: OPCOES.length,
        },
        (index) => resolve(OPCOES[index]?.origem ?? null),
      );
      return;
    }

    Alert.alert('De onde vem o contrato?', undefined, [
      ...OPCOES.map((o) => ({ text: o.label, onPress: () => resolve(o.origem) })),
      { text: 'Cancelar', style: 'cancel' as const, onPress: () => resolve(null) },
    ]);
  });
}

async function escolherPdf(): Promise<ArquivoContrato | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf'],
    copyToCacheDirectory: true,
  });
  const arquivo = resultado.assets?.[0];
  if (resultado.canceled || !arquivo) return null;

  return {
    uri: arquivo.uri,
    nome: arquivo.name,
    mimeType: arquivo.mimeType ?? 'application/pdf',
  };
}

async function escolherImagem(origem: 'camera' | 'galeria'): Promise<ArquivoContrato | null> {
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert(
        'Sem acesso à câmera',
        'Para fotografar o contrato, libere a câmera nos ajustes do aparelho. Você também pode escolher um PDF.',
      );
      return null;
    }
  }

  const resultado =
    origem === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });

  const asset = resultado.assets?.[0];
  if (resultado.canceled || !asset) return null;

  return {
    uri: asset.uri,
    nome: asset.fileName ?? 'contrato.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}
