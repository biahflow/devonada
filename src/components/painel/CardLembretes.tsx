import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useLembretes } from '../../hooks/useLembretes';
import { pedirPermissao, permissaoConcedida } from '../../notificacoes';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  onConfigurar: () => void;
}

/**
 * Ativa e reporta os lembretes locais.
 *
 * A permissão é pedida AQUI, ao tocar em "Ativar" — no contexto, com o motivo
 * visível na tela. Pedir no boot, antes de o usuário saber para quê, é o
 * caminho mais curto para ele negar e nunca mais voltar atrás.
 *
 * O estado "ativo" é a própria permissão do sistema, não uma flag nossa: assim
 * não há como o app achar que está avisando enquanto o aparelho bloqueia.
 */
export function CardLembretes({ onConfigurar }: Props) {
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const { agendados } = useLembretes(permitido === true);

  useEffect(() => {
    permissaoConcedida().then(setPermitido);
  }, []);

  const ativar = useCallback(async () => {
    setPedindo(true);
    try {
      setPermitido(await pedirPermissao());
    } finally {
      setPedindo(false);
    }
  }, []);

  if (permitido === null) return null;

  if (!permitido) {
    return (
      <Card>
        <View style={styles.conteudo}>
          <Text style={styles.titulo}>Quer ser avisado antes de vencer?</Text>
          <Text style={styles.texto}>
            Um lembrete no seu aparelho, no horário que você escolher. Fica tudo aqui — nada é
            enviado para ninguém.
          </Text>
          <Button label="Ativar lembretes" onPress={ativar} variant="secondary" loading={pedindo} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Lembretes ativos</Text>
        <Text style={styles.texto}>
          {agendados === null
            ? 'Organizando os avisos…'
            : agendados === 0
              ? 'Nada a avisar por enquanto. Quando uma parcela se aproximar, você recebe.'
              : agendados === 1
                ? '1 aviso agendado.'
                : `${agendados} avisos agendados.`}
        </Text>
        <Button label="Mudar horário" onPress={onConfigurar} variant="ghost" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  conteudo: { gap: spacing.sm },
  titulo: { ...typography.bodyStrong, color: colors.ink },
  texto: { ...typography.caption, color: colors.inkSoft },
});
