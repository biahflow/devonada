import re
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"
PAGINAS = ("exclusao", "termos", "privacidade")

"""
As páginas públicas (F-018).

O QUE ESTA SUÍTE PROTEGE, e é diferente de "a rota responde 200": que o revisor
da loja e quem perdeu acesso à conta alcancem as três SEM SESSÃO, que elas
continuem se apontando entre si, e que a faixa de MINUTA não seja publicada por
esquecimento — ela some quando o advogado revisar, e não antes.

Um `404` de política de privacidade na frente do revisor é reprovação, e é o
tipo de coisa que ninguém descobre em desenvolvimento porque ninguém abre a
página depois de escrevê-la.
"""


def _html(nome: str) -> str:
    return (WEB / f"{nome}.html").read_text(encoding="utf-8")


class TestAcesso:
    def test_as_tres_abrem_sem_sessao(self, client):
        # SEM `headers=auth` de propósito. Quem perdeu o acesso à conta é
        # justamente quem mais precisa da página de exclusão, e o revisor da
        # loja abre as três num navegador anônimo.
        for pagina in PAGINAS:
            r = client.get(f"/{pagina}")
            assert r.status_code == 200, pagina
            assert r.headers["content-type"].startswith("text/html"), pagina

    def test_a_folha_de_estilo_abre_e_e_css(self, client):
        r = client.get("/publico.css")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/css")

    def test_nenhuma_delas_entra_no_contrato_de_api(self, client):
        # Elas não são contrato: listá-las no OpenAPI faria a superfície
        # documentada mentir sobre o próprio tamanho.
        caminhos = client.get("/openapi.json").json()["paths"]
        for pagina in PAGINAS:
            assert f"/{pagina}" not in caminhos
        assert "/publico.css" not in caminhos


class TestNavegacaoEntreElas:
    def test_as_tres_usam_a_folha_compartilhada(self, client):
        # Divergir de aparência entre páginas legais levanta pergunta em revisão.
        for pagina in PAGINAS:
            assert '<link rel="stylesheet" href="/publico.css" />' in _html(pagina)

    def test_termos_e_privacidade_se_apontam(self, client):
        assert 'href="/privacidade"' in _html("termos")
        assert 'href="/termos"' in _html("privacidade")

    def test_as_duas_apontam_para_a_exclusao(self, client):
        for pagina in ("termos", "privacidade"):
            assert 'href="/exclusao"' in _html(pagina), pagina

    def test_todo_link_interno_aponta_para_pagina_que_existe(self, client):
        # O gêmeo da varredura de tabelas na exclusão de conta: derivado, não
        # lista à mão. Página nova com link para caminho inexistente quebra aqui
        # em vez de na frente do revisor.
        for pagina in PAGINAS:
            for destino in re.findall(r'href="(/[^"#]*)"', _html(pagina)):
                assert client.get(destino).status_code == 200, f"{pagina} → {destino}"


class TestMinuta:
    """
    A faixa de minuta é o que impede um texto não revisado por advogado de ser
    lido como documento final. Ela sai por decisão humana, e este teste é o
    lembrete de que sair é uma decisão — não um esquecimento no sentido inverso.
    """

    def test_termos_e_privacidade_ainda_estao_marcadas_como_minuta(self, client):
        for pagina in ("termos", "privacidade"):
            assert 'class="minuta"' in _html(pagina), pagina

    def test_a_pagina_de_exclusao_nao_e_minuta(self, client):
        # Ela existe desde o M8, já foi publicada e não faz afirmação jurídica
        # nova. A faixa ali seria ruído.
        assert 'class="minuta"' not in _html("exclusao")


class TestConteudoQueAsLojasCobram:
    def test_a_politica_diz_que_o_documento_vai_para_um_provedor_de_ia(self, client):
        """
        Item explícito do `roadmap.md`: o PDF pode conter CPF e dados de
        terceiros, e isso precisa estar dito. Omitir é o tipo de divergência
        entre política e comportamento que motiva remoção.
        """
        texto = _html("privacidade").lower()
        assert "inteligência artificial" in texto
        assert "openai" in texto
        assert "descartado" in texto

    def test_a_politica_declara_a_ausencia_de_rastreamento(self, client):
        # Afirmação verificável: não há analytics nem crash reporter entre as
        # dependências do app.
        texto = _html("privacidade").lower()
        assert "telemetria" in texto
        assert "não coletamos sua localização" in texto

    def test_a_politica_diz_que_ver_e_apagar_nao_dependem_de_assinatura(self, client):
        # Guardrail 9.1 e LGPD art. 18: acesso do titular ao próprio dado não é
        # recurso pago.
        assert "nunca é recurso pago" in _html("privacidade")

    def test_os_termos_negam_as_quatro_coisas_que_o_produto_nao_e(self, client):
        texto = _html("termos").lower()
        for frase in ("não somos instituição financeira", "não somos escritório de advocacia"):
            assert frase in texto
        assert "não negociamos por você" in texto

    def test_nenhuma_pagina_afirma_ilegalidade(self, client):
        # O gêmeo dos testes de copy do produto (guardrail 3), agora nas páginas
        # públicas: elas são lidas por quem está prestes a falar com um credor.
        for pagina in PAGINAS:
            texto = _html(pagina).lower()
            assert "é ilegal" not in texto, pagina
            assert "é seu direito receber" not in texto, pagina

    def test_o_e_mail_de_contato_e_o_do_dominio_atual(self, client):
        # ADR 0020, item 3: o endereço da marca anterior saiu. Uma página legal
        # com e-mail que não recebe é tão ruim quanto e-mail errado.
        for pagina in PAGINAS:
            texto = _html(pagina)
            assert "@devonada.com.br" in texto, pagina
            assert "biahflow" not in texto.lower(), pagina
