import re

from domain import revisao as dominio
from juridico import FONTES, TRILHAS
from juridico.fontes import FonteDesconhecida, citar, obter

"""
O corpus jurídico e a trilha de auditoria (M14).

O QUE ESTA SUÍTE PROTEGE, e é diferente de "as funções funcionam": que nenhuma
fonte fique órfã, que nenhuma trilha cite id inexistente, que todo achado tenha
fundamento resolvível, e que a palavra proibida continue proibida no lugar onde
ela é proibida — sem que isso impeça a lei de ser nomeada onde ela é o assunto.

Um registro de fontes é o tipo de coisa que apodrece em silêncio: alguém remove
o último achado que citava uma norma, a entrada fica, e um ano depois outra
pessoa a cita achando que ela foi revisada para aquele uso.
"""

# Todos os ids citados por alguma regra do produto: os achados de
# `domain/revisao.py` e as trilhas. Derivado, e não uma lista à mão — lista à
# mão envelhece no primeiro achado novo, que é exatamente quando este teste
# precisa continuar valendo.
PRODUTORES_DE_ACHADO = (
    "multa_acima_do_teto",
    "juros_acima_do_teto",
    "tarifa_de_cadastro_repetida",
    "seguro_prestamista_embutido",
    "cet_nao_informado",
)


def _ids_citados_por_achados() -> set[str]:
    """
    Os ids que os produtores de achado usam, lidos do CÓDIGO-FONTE deles.

    Ler o fonte em vez de executar os produtores é deliberado: cada um exige um
    `Contrato` diferente para devolver achado em vez de `None`, e montar cinco
    contratos aqui faria este teste falhar por motivo errado no dia em que uma
    condição mudasse. O que ele quer saber é quais ids o módulo cita.
    """
    import inspect

    blocos = re.findall(r"fonte_ids=\(([^)]*)\)", inspect.getsource(dominio))
    assert blocos, "nenhum `fonte_ids=` encontrado — o formato do achado mudou?"
    return {
        item.strip().strip('"')
        for bloco in blocos
        for item in bloco.split(",")
        if item.strip()
    }


class TestRegistroDeFontes:
    def test_nenhuma_fonte_fica_orfa(self):
        """
        Fonte que ninguém cita é convite a citá-la sem decisão.

        Este teste é o que faz o registro ser "exatamente o que alguma regra
        cita" em vez de uma biblioteca de direito do consumidor que cresce
        sozinha.
        """
        citados = _ids_citados_por_achados()
        for trilha in TRILHAS.values():
            citados.update(trilha.fontes)

        orfas = set(FONTES) - citados
        assert orfas == set(), (
            "Fonte no registro que nenhum achado e nenhuma trilha cita: "
            f"{sorted(orfas)}. Remova, ou use."
        )

    def test_todo_id_citado_existe(self):
        for id_citado in _ids_citados_por_achados():
            assert id_citado in FONTES, id_citado

    def test_id_desconhecido_estoura_em_vez_de_devolver_nada(self):
        # Id inválido é erro de programação nosso, não dado faltando do
        # usuário. Engolir devolveria ao app um achado sem fundamento.
        import pytest

        with pytest.raises(FonteDesconhecida):
            obter("cdc-artigo-que-nao-existe")

    def test_toda_fonte_tem_ementa_vigencia_e_link(self):
        for f in FONTES.values():
            assert f.ementa.strip(), f.id
            assert f.vigencia.strip(), f.id
            assert f.url.startswith("https://"), f.id

    def test_a_citacao_legivel_junta_norma_e_dispositivo(self):
        assert citar("cdc-52-1") == "Código de Defesa do Consumidor, art. 52, § 1º"

    def test_a_lei_14181_entrou_no_corpus(self):
        # O objeto da issue #13. Os ids são `cdc-*` porque a lei ALTEROU o CDC:
        # quem for conferir procura o artigo no Código, não no texto que diz
        # "acrescente-se o art. 54-A".
        for id_novo in ("cdc-54a-1", "cdc-54a-3", "cdc-104a", "cdc-104a-1", "cdc-104c", "cdc-6-xi"):
            assert id_novo in FONTES
            assert "14.181" in FONTES[id_novo].dispositivo


class TestTrilhas:
    def test_toda_trilha_cita_fonte_que_existe(self):
        # Redundante com a conferência que roda no import de `trilhas.py`, e de
        # propósito: aquela protege o processo, esta explica o porquê a quem
        # quebrar o teste.
        for trilha in TRILHAS.values():
            for id_da_fonte in trilha.fontes:
                assert id_da_fonte in FONTES, f"{trilha.chave} → {id_da_fonte}"

    def test_toda_trilha_declara_o_que_a_conta_nao_faz(self):
        """
        `limitacoes` vazio transformaria "como calculamos" em propaganda da
        conta. É onde mora o que o app sabe que não sabe.
        """
        for trilha in TRILHAS.values():
            assert trilha.limitacoes, trilha.chave
            assert trilha.passos, trilha.chave
            assert trilha.formula.strip(), trilha.chave

    def test_nenhuma_trilha_carrega_valor(self):
        """
        A trilha explica a conta; ela NÃO repete os números que a resposta já
        traz ao lado. Duas cópias divergem, e a tela mostraria uma sobra na
        cascata e outra na explicação da cascata.
        """
        for trilha in TRILHAS.values():
            texto = " ".join((trilha.formula, *trilha.passos, *trilha.limitacoes))
            assert "R$" not in texto, trilha.chave
            # Nenhum dígito solto: os únicos números admitidos são os que fazem
            # parte de um prazo da lei ("cinco anos"), escritos por extenso.
            assert not re.search(r"\d", texto), trilha.chave


class TestPalavraProibida:
    """
    O gêmeo dos testes de copy do M4/M6/M7/M11, agora sobre o corpus.

    A REGRA TEM UMA FRONTEIRA, e ela é o ponto deste bloco: o produto nunca diz
    ao usuário que ele *é* algo — nem negando. Mas a lei tem nome, e a ementa da
    norma precisa poder dizer qual instituto ela criou, ou o glossário jurídico
    fica impedido de explicar a própria lei que o M14 acrescentou.
    """

    PROIBIDAS = ("superendividado", "ilegal", "abusiv", "é seu direito")

    def test_nenhuma_trilha_usa_palavra_proibida(self):
        for trilha in TRILHAS.values():
            texto = " ".join((trilha.titulo, trilha.formula, *trilha.passos, *trilha.limitacoes))
            for palavra in self.PROIBIDAS:
                assert palavra not in texto.lower(), f"{trilha.chave}: {palavra}"

    # As normas que a Lei 14.181/2021 criou e cujo ASSUNTO é o instituto. São
    # elas — e só elas — que podem nomeá-lo, porque um glossário jurídico
    # impedido de dizer do que a lei trata não explica lei nenhuma.
    PODEM_NOMEAR = {"cdc-54a-1", "cdc-54a-3", "cdc-104a", "cdc-6-xi"}

    def test_so_a_norma_sobre_o_instituto_pode_nomea_lo(self):
        # Não é exceção aberta: é uma lista fechada, sobre a LEI, num endpoint
        # que descreve normas. O teste existe para a fronteira ser deliberada em
        # vez de acidental — e para quebrar se ela se alargar para uma fonte
        # sobre multa, tarifa ou seguro, onde o termo não teria o que fazer.
        com_o_termo = {f.id for f in FONTES.values() if "superendivid" in f.ementa.lower()}
        assert com_o_termo == self.PODEM_NOMEAR, sorted(com_o_termo ^ self.PODEM_NOMEAR)

    def test_o_termo_nao_escapa_da_ementa(self):
        # `norma` e `dispositivo` são o que a tela mostra como TÍTULO da fonte.
        # O termo ali viraria rótulo, não explicação.
        for f in FONTES.values():
            assert "superendivid" not in f.norma.lower(), f.id
            assert "superendivid" not in f.dispositivo.lower(), f.id

    def test_nenhuma_ementa_afirma_ilegalidade(self):
        for f in FONTES.values():
            assert "ilegal" not in f.ementa.lower(), f.id
            assert "é seu direito" not in f.ementa.lower(), f.id
