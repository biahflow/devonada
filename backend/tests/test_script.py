import inspect
import re

import domain.script as script_mod
from domain.dinheiro import formatar_brl
from domain.revisao import Achado
from domain.script import montar_script

CREDOR = "Banco Exemplo"

# Dois achados com o mesmo formato dos produtores reais de `domain/revisao.py`
# — id, título, explicação e fonte —, usados para provar que o CONTEÚDO não
# muda entre canais, só o formato.
#
# `fonte_ids` são ids REAIS do registro de `juridico/fontes.py` (M14), e não
# strings inventadas: `Achado.fonte` os resolve, então um id fantasia
# estouraria aqui — que é o comportamento certo e vale ser exercitado.
ACHADOS = [
    Achado(
        id="multa-acima-do-teto",
        titulo="Multa acima do teto",
        explicacao="A multa moratória contratada é 5% e o teto é 2%.",
        fonte_ids=("cdc-52-1",),
        como_conferir="Confira a cláusula de multa por atraso no contrato.",
        valor_contestavel=30_000,
    ),
    Achado(
        id="tarifa-de-cadastro-repetida",
        titulo="Tarifa de cadastro repetida",
        explicacao="A tarifa de cadastro já foi cobrada no início do relacionamento.",
        fonte_ids=("stj-sumula-566",),
        como_conferir="Veja se já pagou tarifa semelhante com este credor antes.",
        valor_contestavel=50_000,
    ),
]

CAPACIDADE = 35_000  # R$ 350,00

CANAIS = ("telefone", "chat", "email")

# Mesmo conjunto de termos proibidos de `backend/tests/test_revisao.py::TestCopy`
# (guardrail 3). T6 (F-012) alinha os dois regexes do repositório (PF-4); este
# teste usa o mesmo conjunto porque a copy de negociação é nova e superfície
# do mesmo guardrail.
PROIBIDO = re.compile(
    r"ilegal|abusiv|nul[ao]\b|é seu direito|você tem direito|com certeza|garantid[ao]",
    re.IGNORECASE,
)


class TestMesmoNumeroNosTresCanais:
    """T1-AC1 — os três canais produzem o MESMO valorJusto/achados; só o formato muda."""

    def test_mesmos_achados_nos_tres_canais(self):
        textos_esperados = {f"{a.explicacao} ({a.fonte})" for a in ACHADOS}
        for canal in CANAIS:
            blocos = montar_script(canal, CREDOR, ACHADOS, CAPACIDADE)
            textos_argumento = {b.texto for b in blocos if b.momento == "argumento"}
            assert textos_argumento == textos_esperados, canal

    def test_mesmo_valor_de_oferta_nos_tres_canais(self):
        valor_formatado = formatar_brl(CAPACIDADE)
        for canal in CANAIS:
            blocos = montar_script(canal, CREDOR, ACHADOS, CAPACIDADE)
            oferta = next(b for b in blocos if b.momento == "oferta")
            assert valor_formatado in oferta.texto, canal


class TestPosicionamentoDaOferta:
    """T1-AC2 — ADR 0021, item 5: um teste por canal."""

    def test_telefone_oferta_no_fluxo_normal_antes_do_fechamento(self):
        blocos = montar_script("telefone", CREDOR, [], CAPACIDADE)
        momentos = [b.momento for b in blocos]
        # não existe segunda mensagem numa ligação: a oferta entra no fluxo,
        # não é marcada para "depois".
        assert momentos.index("oferta") < momentos.index("fechamento")
        oferta = next(b for b in blocos if b.momento == "oferta")
        assert "depois" not in oferta.texto.lower()
        assert "depois" not in (oferta.titulo or "").lower()

    def test_chat_oferta_separada_e_marcada_para_depois_da_proposta(self):
        blocos = montar_script("chat", CREDOR, [], CAPACIDADE)
        # a abertura (alerta + saudação) não leva oferta
        abertura = [b for b in blocos if b.momento == "abertura"]
        assert all(b.id != "oferta" for b in abertura)
        oferta = next(b for b in blocos if b.momento == "oferta")
        assert "depois" in (oferta.titulo or "").lower()
        # a regra de pagamento continua fechando o script
        assert blocos[-1].id == "regra-pagamento"

    def test_email_primeiro_email_sem_oferta_texto_do_segundo_pronto(self):
        blocos = montar_script("email", CREDOR, [], CAPACIDADE)
        abertura = [b for b in blocos if b.momento == "abertura"]
        assert all(b.id != "oferta" for b in abertura)
        oferta = next(b for b in blocos if b.momento == "oferta")
        assert "segundo" in (oferta.titulo or "").lower()
        assert blocos[-1].id == "regra-pagamento"


class TestSegurancaAbreEFecha:
    """T1-AC3 — todo script de canal ESCRITO abre com o alerta e fecha com a regra."""

    def test_chat_e_email_abrem_com_alerta_e_fecham_com_regra(self):
        for canal in ("chat", "email"):
            blocos = montar_script(canal, CREDOR, ACHADOS, CAPACIDADE)
            assert blocos[0].id == "alerta-validacao", canal
            assert blocos[0].momento == "abertura", canal
            assert blocos[-1].id == "regra-pagamento", canal
            assert blocos[-1].momento == "fechamento", canal

    def test_telefone_nao_leva_as_duas_constantes_escritas(self):
        # docs/domain.md:316-336 escopa as duas regras aos canais ESCRITOS —
        # telefone é guia de fala, não mensagem para copiar e colar.
        blocos = montar_script("telefone", CREDOR, ACHADOS, CAPACIDADE)
        assert all(b.id not in ("alerta-validacao", "regra-pagamento") for b in blocos)


class TestScriptMinimoDeSeguranca:
    """T1-AC4 — sem achado, o script não é `None` e não afirma nada sobre valor."""

    def test_sem_achado_chat_e_email_ainda_tem_alerta_e_regra(self):
        for canal in ("chat", "email"):
            blocos = montar_script(canal, CREDOR, [], None)
            assert blocos  # nunca None, nunca vazio
            assert blocos[0].id == "alerta-validacao", canal
            assert blocos[-1].id == "regra-pagamento", canal

    def test_sem_achado_telefone_nao_devolve_none(self):
        blocos = montar_script("telefone", CREDOR, [], None)
        assert blocos
        assert not any(b.momento == "argumento" for b in blocos)

    def test_sem_achado_nenhuma_afirmacao_sobre_valor(self):
        for canal in CANAIS:
            blocos = montar_script(canal, CREDOR, [], None)
            texto_completo = " ".join(b.texto for b in blocos).lower()
            assert "valor cobrado" not in texto_completo, canal
            assert "valor justo" not in texto_completo, canal
            assert "irregular" not in texto_completo, canal
            assert not PROIBIDO.search(texto_completo), canal


class TestBlocosCopiaveis:
    """T1-AC5 — no canal `chat`, cada bloco é copiável isoladamente."""

    def test_chat_todo_bloco_copiavel(self):
        blocos = montar_script("chat", CREDOR, ACHADOS, CAPACIDADE)
        assert len(blocos) > 1
        assert all(b.copiavel for b in blocos)

    def test_email_todo_bloco_copiavel(self):
        blocos = montar_script("email", CREDOR, ACHADOS, CAPACIDADE)
        assert all(b.copiavel for b in blocos)

    def test_telefone_nenhum_bloco_copiavel(self):
        # é guia de fala, não mensagem — não há botão de copiar por bloco.
        blocos = montar_script("telefone", CREDOR, ACHADOS, CAPACIDADE)
        assert not any(b.copiavel for b in blocos)


class TestSemLLM:
    """T1-AC6 — nenhuma chamada a LLM entra no módulo, e o docstring diz por quê."""

    def test_modulo_nao_importa_llm(self):
        fonte = inspect.getsource(script_mod)
        assert "import llm" not in fonte
        assert "from llm" not in fonte

    def test_docstring_explica_a_ausencia_de_llm(self):
        assert script_mod.__doc__ is not None
        assert "LLM" in script_mod.__doc__


class TestCopyNasTresVariantes:
    """
    Guardrail 3: nenhuma afirmação de ilegalidade ou direito, em nenhum canal.

    Molde de `TestCopy` em `backend/tests/test_revisao.py`.
    """

    def test_nenhum_bloco_afirma_ilegalidade_ou_direito(self):
        for canal in CANAIS:
            blocos = montar_script(canal, CREDOR, ACHADOS, CAPACIDADE)
            for bloco in blocos:
                assert not PROIBIDO.search(bloco.texto), f"{canal}/{bloco.id}: {bloco.texto}"
                if bloco.titulo:
                    assert not PROIBIDO.search(bloco.titulo), f"{canal}/{bloco.id}: {bloco.titulo}"

    def test_capacidade_negativa_nao_vira_oferta(self):
        for canal in CANAIS:
            blocos = montar_script(canal, CREDOR, [], -1_000)
            assert not any(b.momento == "oferta" for b in blocos)
