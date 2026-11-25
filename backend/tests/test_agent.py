"""48 casos do agente (portados dos testes originais em TS), contra o motor Python."""
import re

import pytest

from app import agent, service


class Ctx:
    def __init__(self, session):
        self.s = session
        self.cart = None
        self.sync()

    def sync(self):
        st = service.snapshot(self.s, "e", student_id="seed-luiz")
        self.menu, self.orders = st["menu"], st["orders"]
        if self.cart is None:
            self.cart = agent.Cart([], self.menu)
        self.cart.menu = {m["id"]: m for m in self.menu}

    def say(self, text):
        self.sync()
        return agent.respond(text, self.menu, self.orders, self.cart, "Luiz")

    def q(self, id_):
        return self.cart.qty(id_)

    def price(self, id_):
        return next(m["price"] for m in self.menu if m["id"] == id_)


@pytest.fixture()
def c(session):
    return Ctx(session)


def att(r, t):
    return next((a for a in r["attach"] if a["type"] == t), None)


def tools(r):
    return [t["name"] for t in r["tools"]]


def ids(r):
    return att(r, "items")["ids"]


# --- cardápio: dúvidas
def test_sem_acucar_hoje(c):
    r = c.say("O que tem sem açúcar hoje?")
    assert "buscar_cardapio" in tools(r)
    assert "natural" in ids(r) and "suco-laranja" in ids(r) and "misto" not in ids(r)


def test_vegetariano(c):
    i = ids(c.say("tem opção vegetariana?"))
    assert "empada" in i and "coxinha" not in i


def test_sem_acucar_e_vegetariano(c):
    i = ids(c.say("quero ver os itens sem açúcar e vegetarianos"))
    assert i and "natural" not in i


def test_preco_xburguer(c):
    assert "R$ 18,00" in c.say("quanto custa o x-burguer?")["text"]


def test_preco_cafe_sem_acento(c):
    assert "R$ 4,00" in c.say("QUAL O PRECO DO CAFE")["text"]


def test_o_que_tem_hoje(c):
    i = ids(c.say("o que tem hoje?"))
    assert len(i) >= 10 and "cookie" not in i


def test_item_esgotado(c):
    assert "esgotado" in c.say("tem cookie?")["text"]


def test_lista_de_esgotados(c):
    assert "Cookie" in c.say("o que está esgotado?")["text"]


def test_so_sucos(c):
    i = ids(c.say("quais sucos vocês tem?"))
    assert len(i) == 3 and all(x.startswith("suco") for x in i)


def test_ate_n_reais(c):
    i = ids(c.say("algo até 6 reais?"))
    assert i and all(c.price(x) <= 6 for x in i)


def test_mais_barato(c):
    assert c.price(ids(c.say("quais os mais baratos?"))[0]) == 3


# --- montar pedido
def test_misto_e_suco(c):
    r = c.say("quero um misto e um suco")
    assert c.q("misto") == 1 and c.q("suco-laranja") == 1 and c.cart.total() == 17 and att(r, "cart") and "adicionar_ao_carrinho" in tools(r)


def test_quantidades(c):
    c.say("2 sucos de laranja e um misto")
    assert c.q("suco-laranja") == 2 and c.q("misto") == 1 and c.cart.total() == 23


def test_quantidades_por_extenso(c):
    c.say("quero dois pães de queijo e uma coxinha")
    assert c.q("pao-queijo") == 2 and c.q("coxinha") == 1


def test_quantidade_numerica_plural(c):
    c.say("quero 3 coxinhas")
    assert c.q("coxinha") == 3


def test_maiusculas_nome_completo(c):
    c.say("QUERO UM MISTO QUENTE COM SUCO DE LARANJA")
    assert c.cart.total() == 17


def test_erro_de_digitacao(c):
    c.say("quero um misot e uma cuxinha")
    assert c.q("misto") == 1 and c.q("coxinha") == 1


def test_sem_verbo(c):
    c.say("x burguer")
    assert c.q("xburguer") == 1


def test_suco_generico_assume_laranja(c):
    r = c.say("quero um suco")
    assert c.q("suco-laranja") == 1 and "maracujá" in r["text"]


def test_acumula(c):
    c.say("quero um suco")
    c.say("adiciona mais um suco")
    assert c.q("suco-laranja") == 2


def test_indisponivel(c):
    r = c.say("quero um cookie")
    assert c.cart.count() == 0 and "esgotado" in r["text"]


def test_desativado_pela_cantina(c, session):
    service.patch_menu(session, "misto", False, None)
    r = c.say("quero um misto")
    assert c.q("misto") == 0 and "esgotado" in r["text"]


def test_inexistente(c):
    r = c.say("quero uma pizza")
    assert c.cart.count() == 0 and re.search(r'N[ãa]o encontrei "pizza"', r["text"])


def test_parte_existe_parte_nao(c):
    r = c.say("quero um misto e uma pizza")
    assert c.q("misto") == 1 and "pizza" in r["text"]


def test_pedido_generico_lanche(c):
    r = c.say("quero um lanche")
    assert c.cart.count() == 0 and "misto" in ids(r)


# --- editar carrinho
def test_tirar_item(c):
    c.say("quero um misto e um suco")
    c.say("tira o suco")
    assert c.q("suco-laranja") == 0 and c.q("misto") == 1


def test_tirar_uma_unidade(c):
    c.say("quero 2 sucos")
    c.say("tira um suco")
    assert c.q("suco-laranja") == 1


def test_tirar_o_que_nao_esta(c):
    c.say("quero um misto")
    assert "não está" in c.say("tira o café")["text"] and c.q("misto") == 1


def test_trocar_item(c):
    c.say("quero um misto e um suco")
    c.say("troca o suco por café")
    assert c.q("suco-laranja") == 0 and c.q("cafe") == 1 and c.q("misto") == 1


def test_trocar_sem_dizer_o_que_sai(c):
    c.say("quero um misto e um suco")
    c.say("troca por cappuccino")
    assert c.q("suco-laranja") == 0 and c.q("cappuccino") == 1


def test_trocar_por_esgotado(c):
    c.say("quero um misto")
    assert "esgotado" in c.say("troca o misto por cookie")["text"] and c.q("misto") == 1


def test_trocar_uma_unidade(c):
    c.say("quero 2 sucos")
    c.say("troca um suco por café")
    assert c.q("suco-laranja") == 1 and c.q("cafe") == 1


def test_limpar_carrinho(c):
    c.say("quero um misto")
    c.say("limpa o carrinho")
    assert c.cart.count() == 0


# --- status, combos, carrinho
def test_status_do_pedido(c):
    r = c.say("status do meu pedido")
    assert "#0042" in r["text"] and "consultar_status_pedido" in tools(r) and att(r, "status")["number"] == 42


def test_status_com_acento(c):
    assert "#0042" in c.say("cadê meu pedido?")["text"]


def test_status_de_pedido_alheio(c):
    assert "Não encontrei" in c.say("pedido 41")["text"]


def test_status_reflete_a_cozinha(c, session):
    service.confirm_payment(session, 42)
    service.update_status(session, 42, "pronto")
    assert "pronto" in c.say("meu pedido já ficou pronto?")["text"]


def test_combo_pelo_historico(c):
    r = c.say("sugira um combo")
    combo = att(r, "combos")["combos"][0]
    assert "sugerir_combo" in tools(r) and combo["ids"] == ["misto", "suco-laranja"] and combo["price"] == 17


def test_ir_ao_carrinho(c):
    c.say("quero um misto")
    assert att(c.say("quero ir para o carrinho"), "cart")


def test_carrinho_vazio(c):
    assert "vazio" in c.say("ver carrinho")["text"]


def test_quanto_deu(c):
    c.say("quero um misto e um suco")
    assert att(c.say("quanto deu?"), "cart")


def test_finalizar(c):
    c.say("quero um misto")
    assert "Confirmar pedido" in c.say("pode finalizar")["text"]


# --- conversa geral
@pytest.mark.parametrize("msg,expected", [("como pago?", "maquininha"), ("oi", "Olá"), ("obrigado", "nada"), ("o que você faz?", "cardápio"), ("asdfgh", "Não entendi"), ("   ", "escrever")])
def test_conversa_geral(c, msg, expected):
    assert expected in c.say(msg)["text"]
