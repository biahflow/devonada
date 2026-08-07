from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

"""
Situação da assinatura: em teste, ativa ou expirada.

AQUI NÃO HÁ FONTE A CITAR, E ISSO É DELIBERADO — não é docstring pela metade.

A regra de `CLAUDE.md` é que nenhuma REGRA FINANCEIRA é inventada: multa, juros,
mínimo existencial e teto de consignado levam artigo de lei porque descrevem
dinheiro que a lei define, e um número chutado ali sai na tela do usuário como se
fosse direito dele. Sete dias de teste não é dessa classe. É escolha comercial do
dono do produto, da mesma natureza do preço — não existe decreto de período de
avaliação, e procurar um seria confundir as duas coisas.

O que este módulo herda da mesma disciplina é a forma: função pura, sem I/O, sem
relógio próprio (`agora` é parâmetro), decisão em um lugar só. Se um leitor
futuro precisar mudar o teste de sete para catorze, muda a config e nada mais.

ELE NÃO É PRECEDENTE PARA O PRÓXIMO `* 1.1`. A diferença entre este arquivo e
aquele coeficiente é que aqui o número descreve o que NÓS decidimos cobrar, e lá
descrevia o que o USUÁRIO deveria pagar a um credor. O primeiro é nosso para
escolher; o segundo, não.
"""

Status = Literal["em_teste", "ativa", "expirada"]


@dataclass(frozen=True)
class Situacao:
    status: Status
    expira_em: datetime
    dias_restantes: int

    @property
    def pode_escrever(self) -> bool:
        return self.status != "expirada"


@dataclass(frozen=True)
class AssinaturaConhecida:
    """
    O que o banco sabe da última compra conferida com a loja.

    Espelha `orm.Assinatura` sem importá-lo: o domínio não conhece SQLAlchemy,
    pelo mesmo motivo que `domain/caixa.py` recebe dataclasses e não linhas —
    `backend/leitura.py` é quem traduz tabela em entrada de função pura.
    """

    expira_em: datetime
    renovacao_automatica: bool


def situacao(
    criado_em: datetime,
    assinatura: AssinaturaConhecida | None,
    agora: datetime,
    teste_dias: int,
) -> Situacao:
    """
    A situação de quem escreve, em uma decisão só.

    ORDEM: assinatura paga vence o teste, e não o contrário. Quem assina no
    terceiro dia do teste não perde os quatro dias restantes, mas também não
    ganha sete dias somados ao período pago — o que vale é a data mais distante
    entre as duas, porque é a que o usuário já tem na mão.

    `renovacao_automatica` desligada NÃO expira nada. Cancelar desliga a
    renovação; o período pago continua valendo até `expira_em`. Cobrar de novo
    de quem já pagou até o dia 30 é o erro que vira avaliação de uma estrela, e
    ele nasce exatamente de confundir "cancelou" com "acabou".
    """
    fim_do_teste = _utc(criado_em) + timedelta(days=teste_dias)
    fim = fim_do_teste
    paga = False

    if assinatura is not None:
        fim_pago = _utc(assinatura.expira_em)
        if fim_pago > fim:
            fim = fim_pago
        # `paga` olha a data da compra, não a data final: quem tem compra válida
        # está "ativo" mesmo que o teste ainda dure mais um dia. Dizer "em teste"
        # a quem já pagou é dizer que ele vai ser cobrado de novo em breve.
        paga = fim_pago > _utc(agora)

    if _utc(agora) >= fim:
        return Situacao(status="expirada", expira_em=fim, dias_restantes=0)

    # Arredondado PARA CIMA: faltando 30 horas, a tela diz "2 dias". Truncar
    # diria "1 dia" para quem ainda tem um dia inteiro e mais seis horas, e
    # subestimar o prazo de alguém em aperto financeiro é o erro que este
    # produto menos pode cometer.
    restantes = -((_utc(agora) - fim).days)

    return Situacao(
        status="ativa" if paga else "em_teste",
        expira_em=fim,
        dias_restantes=restantes,
    )


def _utc(quando: datetime) -> datetime:
    """
    Data ingênua vira UTC.

    O SQLite não guarda fuso, então uma coluna `DateTime(timezone=True)` volta
    ingênua da suíte e com fuso do Postgres. Comparar as duas levanta TypeError,
    e ele apareceria aqui — no meio de uma decisão de cobrança — em vez de na
    borda. `backend/auth.py` normaliza pelo mesmo motivo, com a mesma função.
    """
    return quando if quando.tzinfo else quando.replace(tzinfo=timezone.utc)
