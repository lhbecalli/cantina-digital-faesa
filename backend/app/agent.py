"""Agente de IA da cantina, por regras e palavras-chave (sem LLM), com "function calling" simulado:
cada resposta traz as tools chamadas e seus argumentos. Tolerante a acentos, maiúsculas, plural e erros simples
de digitação (distância de edição). Roda no BACKEND: o app envia a mensagem + o carrinho e recebe resposta, tools e o novo carrinho.
Nenhuma entrada do usuário é executada: só casa com expressões regulares fixas."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

NUMW = {"um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6}
ALIAS: dict[str, list[str]] = {
    "misto": ["misto", "misto quente", "queijo quente"],
    "natural": ["natural", "sanduiche natural", "natural de peru"],
    "natural-veg": ["natural vegetariano", "natural vegetariana", "sanduiche natural vegetariano", "natural vegano"],
    "xburguer": ["x burguer", "xburguer", "x burger", "xburger", "x-burguer", "x-burger", "hamburguer", "burguer", "burger"],
    "pao-queijo": ["pao de queijo", "paes de queijo", "pao queijo"],
    "coxinha": ["coxinha"],
    "empada": ["empada", "empada de palmito"],
    "suco-laranja": ["suco de laranja", "suco laranja", "laranja", "suco"],
    "suco-maracuja": ["suco de maracuja", "suco maracuja", "maracuja"],
    "suco-verde": ["suco verde"],
    "cafe": ["cafe", "cafezinho", "expresso", "espresso"],
    "cappuccino": ["cappuccino", "capuccino", "capuchino", "cappucino"],
    "agua": ["agua", "agua mineral"],
    "refri": ["refrigerante", "refri", "coca", "guarana", "coca cola"],
    "salada-frutas": ["salada de frutas", "salada de fruta"],
    "brownie": ["brownie"],
    "cookie": ["cookie", "cookie de aveia", "biscoito"],
}
CAT_WORDS = [
    ("sucos", re.compile(r"\bsucos?\b")), ("salgados", re.compile(r"\bsalgad(o|os|inho|inhos)\b")),
    ("doces", re.compile(r"\bdoces?\b|\bsobremesas?\b")), ("lanches", re.compile(r"\blanches?\b|\bsanduiches?\b")), ("bebidas", re.compile(r"\bbebidas?\b")),
]
ORDER_VERB = re.compile(r"\b(quero|queria|quer|vou querer|vou levar|me ve|me da|me traz|manda|mande|pede|pedir|peco|adiciona|adicione|adicionar|coloca|coloque|bota|gostaria|separa|reserva|poe|ponha|levo|leva)\b")
QUESTION = re.compile(r"\?|\b(tem|tem algum|qual|quais|o que|que tipo|existe|sobrou|ainda tem|opcao|opcoes|quanto custa|preco|valor|vale quanto)\b")
STOP = re.compile(r"^(hoje|tudo|pedido|pedir|quero|queria|mais|para|esse|essa|isso|algo|quais|qual|como|preco|doce|doces|lanche|lanches|combo|menu|carrinho|total|itens|item|limpar|tirar|trocar|sabor|sabores|fruta|frutas|status|ajuda|valor|custa|barato|sobremesa|bebida|bebidas|salgado|salgados|sucos|cardapio|opcoes|disponivel|esgotado|mesmo|outro|outra|vegetariano|vegetariana|acucar|nada|pode|obrigado|obrigada)$")
QTY_RE = re.compile(r"(?:^|\s)(\d+)\s*x?\s|(?:^|\s)(um|uma|dois|duas|tres|quatro|cinco|seis)(?:\s|$)")
SUGGESTIONS = ["O que tem sem açúcar hoje?", "Quero um misto e um suco", "Status do meu pedido", "Sugira um combo", "Tem opção vegetariana?"]


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def brl(v: float) -> str:
    return "R$ " + f"{v:.2f}".replace(".", ",")


def order_label(n: int) -> str:
    return f"#{n:04d}"


def time_of(ts: int | None) -> str:
    from datetime import datetime
    return datetime.fromtimestamp(ts / 1000).strftime("%H:%M") if ts else "--:--"


def keys_for(item: dict) -> list[str]:
    return [*ALIAS.get(item["id"], []), norm(item["name"])]


def lev(a: str, b: str) -> int:
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (0 if a[i - 1] == b[j - 1] else 1))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len(a)][len(b)]


def find_item(seg: str, menu: list[dict]) -> dict | None:
    best, score = None, 0
    for it in menu:
        for k in keys_for(it):
            if len(k) > score and re.search(r"(^|[\s,.!?])" + re.escape(k) + r"(s|es)?(?=$|[\s,.!?])", seg):
                best, score = it, len(k)
    if best:
        return best
    words = [w for w in re.split(r"[\s,.!?;+]+", seg) if len(w) >= 4 and not STOP.match(w) and not w.isdigit()]
    grams: list[str] = []
    for i, w in enumerate(words):
        grams.append(w)
        if i + 1 < len(words):
            grams.append(w + " " + words[i + 1])
    best_d, best_len = 99, 0
    for it in menu:
        for k in keys_for(it):
            if len(k) < 4:
                continue
            tol = 1 if len(k) <= 9 else 2
            for g in grams:
                for c in ([g, g[:-1]] if g.endswith("s") else [g]):
                    if abs(len(c) - len(k)) > tol:
                        continue
                    d = lev(c, k)
                    if d <= tol and (d < best_d or (d == best_d and len(k) > best_len)):
                        best, best_d, best_len = it, d, len(k)
    return best


def find_qty(seg: str) -> int:
    m = QTY_RE.search(seg)
    if not m:
        return 1
    return min(20, max(1, int(m.group(1)))) if m.group(1) else NUMW[m.group(2)]


def has_qty(seg: str) -> bool:
    return QTY_RE.search(seg) is not None


def split_segments(text: str) -> list[str]:
    return [p for p in re.split(r"\s*(?:,|\+|;|\be\b|\bmais\b|\btambem\b|\bcom\b|\balem de\b)\s*", text) if p]


def leftover(seg: str) -> str:
    s = ORDER_VERB.sub(" ", seg, count=1)
    s = re.sub(r"\b(um|uma|dois|duas|tres|quatro|cinco|seis|\d+x?|o|a|os|as|de|do|da|por favor|pf|favor|tambem|mais|so|ai|ja|me|pra|para|eu|queria|quero|vou|levar|pode|ser|que|ver|gostaria)\b", " ", s)
    return re.sub(r"\s+", " ", re.sub(r"[?!.]", " ", s)).strip()


class Cart:
    """Carrinho da sessão (lista de {id, qty}); o agente altera uma cópia e devolve o resultado."""

    def __init__(self, lines: list[dict] | None, menu: list[dict], via_ia: bool = False) -> None:
        self.menu = {m["id"]: m for m in menu}
        self.data = [{"id": ln["id"], "qty": int(ln["qty"])} for ln in (lines or []) if ln.get("id") in self.menu and int(ln.get("qty", 0)) > 0]
        self.via_ia = via_ia

    def lines(self) -> list[dict]:
        return [{"id": ln["id"], "qty": ln["qty"], "item": self.menu[ln["id"]]} for ln in self.data]

    def qty(self, id_: str) -> int:
        return next((ln["qty"] for ln in self.data if ln["id"] == id_), 0)

    def count(self) -> int:
        return sum(ln["qty"] for ln in self.data)

    def total(self) -> float:
        return sum(ln["qty"] * self.menu[ln["id"]]["price"] for ln in self.data)

    def add(self, id_: str, qty: int = 1, via_ia: bool = False) -> None:
        for ln in self.data:
            if ln["id"] == id_:
                ln["qty"] = min(20, ln["qty"] + qty)
                break
        else:
            self.data.append({"id": id_, "qty": min(20, qty)})
        self.via_ia = self.via_ia or via_ia

    def set_qty(self, id_: str, qty: int) -> None:
        if qty <= 0:
            self.data = [ln for ln in self.data if ln["id"] != id_]
        else:
            for ln in self.data:
                if ln["id"] == id_:
                    ln["qty"] = min(20, qty)
        if not self.data:
            self.via_ia = False

    def remove(self, id_: str) -> None:
        self.set_qty(id_, 0)

    def clear(self) -> None:
        self.data, self.via_ia = [], False


def _status_reply(o: dict) -> str:
    num = order_label(o["number"])
    st = o["status"]
    if st == "aguardando":
        return f"Seu pedido {num} está aguardando pagamento. Pague na maquininha do balcão e mostre o QR do ticket."
    if st == "preparo":
        return f"Seu pedido {num} está em preparo desde as {time_of(o['history'].get('preparo'))}. Avisamos quando ficar pronto."
    if st == "pronto":
        return f"Seu pedido {num} está pronto. Retire no balcão."
    return f"Seu pedido {num} já foi retirado."


def _favorite_combo(orders: list[dict]) -> dict | None:
    pairs: dict[str, int] = {}
    for o in orders:
        ids = sorted(i["id"] for i in o["items"])
        for a in range(len(ids)):
            for b in range(a + 1, len(ids)):
                k = ids[a] + "|" + ids[b]
                pairs[k] = pairs.get(k, 0) + 1
    if not pairs:
        return None
    k = max(pairs, key=lambda x: pairs[x])
    return {"ids": k.split("|"), "times": pairs[k]}


def respond(raw: str, menu: list[dict], orders: list[dict], cart: Cart, user: str = "Aluno") -> dict[str, Any]:
    """Devolve {text, tools, attach}. `orders` são os pedidos DO ALUNO; `cart` é alterado no lugar."""
    text = norm(raw).strip()
    tools: list[dict] = []
    attach: list[dict] = []

    def call(name: str, args: dict, result: str) -> None:
        tools.append({"name": name, "args": args, "result": result})

    def reply(t: str) -> dict:
        return {"text": t, "tools": tools, "attach": attach}

    def item(id_: str) -> dict | None:
        return next((m for m in menu if m["id"] == id_), None)

    def avail_ids(ids: list[str]) -> bool:
        return all((item(i) or {}).get("available") for i in ids)

    avail = [i for i in menu if i["available"]]
    mine = orders
    cart_menu = lambda: [ln["item"] for ln in cart.lines()]  # noqa: E731

    if not text:
        return reply("Pode escrever o que você quer pedir ou perguntar.")

    # 0) ajuda / saudação / agradecimento
    if re.search(r"\b(ajuda|ajudar|o que (voce|vc) faz|como (funciona|usar)|o que posso)\b", text):
        return reply("Posso mostrar o cardápio e filtrar por sem açúcar ou vegetariano, montar seu pedido, trocar ou tirar itens, informar o status e sugerir combos.")
    if re.search(r"^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite|hey|hello)\b", text) and len(text.split(" ")) <= 4:
        return reply(f"Olá, {user}. Posso mostrar o cardápio, montar seu pedido, ver o status ou sugerir um combo.")
    if re.search(r"\b(obrigad\w*|valeu|brigad\w*|vlw)\b", text) and not ORDER_VERB.search(text):
        return reply("De nada.")

    # 1) status do pedido
    if (re.search(r"\b(status|cade|onde esta|ja (ta|esta|ficou|saiu)|ficou pronto|meu pedido|andamento|quanto tempo|quanto falta|demora|ja pode retirar)\b|\bpedido\s*(numero|n)?\s*#?\s*\d", text)
            and not ORDER_VERB.search(text)):
        m = re.search(r"#\s*0*(\d{1,4})\b|pedido\s*(?:numero|n)?\s*0*(\d{1,4})\b", text)
        o = None
        if m:
            nn = int(m.group(1) or m.group(2))
            o = next((x for x in mine if x["number"] == nn), None)
            if not o:
                call("consultar_status_pedido", {"aluno": user, "numero": nn}, "não encontrado")
                return reply(f"Não encontrei o pedido {order_label(nn)} na sua conta.")
        if not o:
            active = sorted((x for x in mine if x["status"] != "retirado"), key=lambda x: -x["createdAt"])
            o = active[0] if active else None
        call("consultar_status_pedido", {"aluno": user, "numero": o["number"] if o else None}, f"{order_label(o['number'])} · {o['status']}" if o else "nenhum pedido ativo")
        if not o:
            return reply("Você não tem pedidos em andamento. Quer ver o cardápio ou montar um pedido?")
        attach.append({"type": "status", "number": o["number"]})
        return reply(_status_reply(o))

    # 2) combos
    if re.search(r"\b(combo|combos|sugest\w*|sugira|recomend\w*|indica\w*|o que pedir|me ajuda a escolher|o de sempre)\b", text):
        hist = [o for o in mine if o["status"] == "retirado"]
        fav = _favorite_combo(hist)
        call("consultar_historico", {"aluno": user, "limite": 10}, f"{len(hist)} pedidos anteriores")
        combos: list[dict] = []
        price_of = lambda ids: sum((item(i) or {"price": 0})["price"] for i in ids)  # noqa: E731
        if fav and avail_ids(fav["ids"]):
            combos.append({"ids": fav["ids"], "label": "Seu pedido de sempre", "note": f"Você já pediu {fav['times']}x", "price": price_of(fav["ids"])})
        light = ["natural", "suco-laranja"]
        if avail_ids(light) and not any(c["ids"] == light for c in combos):
            combos.append({"ids": light, "label": "Combo leve", "note": "Sem açúcar adicionado", "price": price_of(light)})
        call("sugerir_combo", {"aluno": user, "base": "historico_pedidos"}, f"{len(combos)} combos")
        if not combos:
            return reply("Hoje não consegui montar um combo com itens disponíveis. Quer ver o cardápio?")
        attach.append({"type": "combos", "combos": combos})
        return reply("Com base nos seus pedidos anteriores:")

    # 3) limpar carrinho
    if re.search(r"\b(limp\w*|esvazi\w*|zer\w*)\b.*\bcarrinho\b|\bcancel\w*\b.*\b(carrinho|tudo|pedido)\b|\bcomecar de novo\b|\bapaga\w* tudo\b", text):
        cart.clear()
        call("limpar_carrinho", {}, "ok")
        return reply("Carrinho esvaziado.")

    # 4) trocar item
    if re.search(r"\b(troca\w*|substitu\w*|muda\w*)\b", text):
        parts = re.split(r"\bpor\b|\bpelo\b|\bpela\b", text)
        right = find_item(parts[1], menu) if len(parts) > 1 else None
        left = find_item(parts[0], cart_menu() or menu) if len(parts) > 1 else None
        lines = cart.lines()
        if not right:
            return reply('Troco por qual item? Por exemplo: "troca o suco por café".')
        if not right["available"]:
            call("buscar_cardapio", {"busca": right["name"]}, "esgotado")
            return reply(f"{right['name']} está esgotado hoje. Quer outra opção?")
        if not left and lines:
            left = lines[-1]["item"]
        lline = next((ln for ln in lines if left and ln["id"] == left["id"]), None)
        if not left or not lline:
            return reply("Seu carrinho não tem o que trocar. Diga o que você quer pedir.")
        q = min(find_qty(parts[0]), lline["qty"]) if len(parts) > 1 and has_qty(parts[0]) else lline["qty"]
        cart.set_qty(left["id"], lline["qty"] - q)
        cart.add(right["id"], q, True)
        call("remover_do_carrinho", {"item_id": left["id"], "quantidade": q}, "ok")
        call("adicionar_ao_carrinho", {"item_id": right["id"], "quantidade": q}, "ok")
        attach.append({"type": "cart"})
        return reply(f"Troquei {q}x {left['name']} por {right['name']}.")

    # 5) remover item do carrinho
    if re.search(r"\b(tira|tire|tirar|remove|remova|remover|retira|retire|retirar|exclui|exclua)\b", text) and not re.search(r"\bsem acucar\b", text):
        in_cart = cart_menu()
        rm = find_item(text, in_cart)
        if not rm:
            for cat, rx in CAT_WORDS:
                if not rm and rx.search(text):
                    rm = next((i for i in in_cart if i["cat"] == cat), None)
        if not rm:
            anyi = find_item(text, menu)
            if anyi:
                return reply(f"{anyi['name']} não está no seu carrinho.")
            return reply("Qual item devo tirar? Está no carrinho: " + ", ".join(i["name"] for i in in_cart) + "." if in_cart else "Seu carrinho está vazio.")
        cur = cart.qty(rm["id"])
        take = find_qty(text) if has_qty(text) else cur
        cart.set_qty(rm["id"], cur - take)
        call("remover_do_carrinho", {"item_id": rm["id"], "quantidade": min(take, cur)}, "ok")
        attach.append({"type": "cart"})
        return reply(f"Tirei {min(take, cur)}x {rm['name']} do carrinho.")

    # 6) ver carrinho / finalizar
    if re.search(r"\b(carrinho|quanto (deu|ficou|to devendo)|meu total|qual (e )?o total|resumo)\b", text) and (not ORDER_VERB.search(text) or re.search(r"\b(ir|vai|abrir|abre|ver|mostr\w*)\b.*\bcarrinho\b", text)):
        call("ver_carrinho", {}, f"{cart.count()} itens")
        if not cart.count():
            return reply("Seu carrinho está vazio. Quer começar por um misto e um suco?")
        attach.append({"type": "cart"})
        return reply('Toque em "Ir para o carrinho" para revisar e confirmar.' if re.search(r"\b(ir|abrir|abre|ver|mostra\w*|vai)\b", text) else "Seu carrinho:")
    if re.search(r"\b(finalizar|fechar|fecha|confirmar|confirma|concluir|terminar|e so isso|so isso|pagar)\b", text) and not ORDER_VERB.search(text):
        if not cart.count():
            return reply("Seu carrinho está vazio. Diga o que você quer pedir.")
        call("ver_carrinho", {}, f"{cart.count()} itens")
        attach.append({"type": "cart"})
        return reply('Revise o carrinho e toque em "Confirmar pedido". O pagamento é na maquininha, no balcão.')

    # 7) montar pedido
    found: list[dict] = []
    missing: list[dict] = []
    for sg in split_segments(text):
        it = find_item(sg, menu)
        if it:
            found.append({"item": it, "qty": find_qty(sg), "seg": sg})
        elif ORDER_VERB.search(text):
            lo = leftover(sg)
            if lo:
                missing.append({"text": lo, "seg": sg})
    is_question = bool(QUESTION.search(raw.lower()) or QUESTION.search(text))
    wants_price = re.search(r"\b(quanto custa|quanto (e|sai|fica|esta)|preco|valor|vale quanto|custa)\b", text) is not None
    if found and not wants_price and (ORDER_VERB.search(text) or not is_question):
        added: list[dict] = []
        blocked: list[dict] = []
        notes: list[str] = []
        for f in found:
            if not f["item"]["available"]:
                blocked.append(f["item"])
                continue
            cart.add(f["item"]["id"], f["qty"], True)
            call("adicionar_ao_carrinho", {"item_id": f["item"]["id"], "quantidade": f["qty"]}, "ok")
            added.append(f)
            if f["item"]["id"] == "suco-laranja" and "laranja" not in f["seg"]:
                others = [i["name"].replace("Suco de ", "").replace("Suco ", "").lower() for i in avail if i["cat"] == "sucos" and i["id"] != "suco-laranja"]
                notes.append("Considerei suco de laranja" + (f"; também temos {' e '.join(others)}." if others else "."))
            if f["item"]["id"] == "natural" and not re.search(r"vegetarian|vegan", f["seg"]) and avail_ids(["natural-veg"]):
                notes.append("Temos também o Natural Vegetariano.")
        t = ""
        if added:
            t += "Adicionei: " + ", ".join(f"{a['qty']}x {a['item']['name']}" for a in added) + "."
        if blocked:
            alt = next((i for i in avail if i["cat"] == blocked[0]["cat"]), None)
            t += (" " if t else "") + ", ".join(b["name"] for b in blocked) + " está esgotado hoje" + (f". Que tal {alt['name']}?" if alt else ".")
        if missing:
            t += ' Não encontrei "' + '", "'.join(m["text"] for m in missing) + '" no cardápio.'
        if notes:
            t += " " + notes[0]
        has_main = any(a["item"]["cat"] in ("lanches", "salgados") for a in added)
        drink = any(ln["item"]["cat"] in ("sucos", "bebidas") for ln in cart.lines())
        if added:
            call("ver_carrinho", {}, f"{cart.count()} itens · {brl(cart.total())}")
            attach.append({"type": "cart"})
        if added and has_main and not drink:
            t += " Quer acompanhar com um suco ou café?"
        return reply(t or "Não consegui adicionar esses itens.")

    # 8) pedido sem item reconhecido
    view_intent = re.search(r"\b(ver|mostr\w*|list\w*|exib\w*)\b", text) or re.search(r"acucar|vegetarian|vegan|barat\w*|\bate \d+", text)
    if ORDER_VERB.search(text) and not found and not view_intent:
        cat_hit = None
        for cat, rx in CAT_WORDS:
            if rx.search(text):
                cat_hit = cat
        if cat_hit:
            opts = [i for i in avail if i["cat"] == cat_hit]
            call("buscar_cardapio", {"categoria": cat_hit, "apenas_disponiveis": True}, f"{len(opts)} itens")
            if opts:
                attach.append({"type": "items", "ids": [i["id"] for i in opts]})
                return reply(f"Qual dos {cat_hit} você quer?")
        lo = leftover(text)
        call("buscar_cardapio", {"busca": lo or text}, "0 itens")
        return reply((f'Não encontrei "{lo}" no cardápio de hoje.' if lo else "Não entendi o que você quer pedir.") + " Posso mostrar os lanches, salgados, sucos ou doces.")

    # 9) consultas ao cardápio
    filtro: dict[str, Any] = {}
    tags: list[str] = []
    if re.search(r"acucar|diet|\bzero\b|saudavel|\blight\b", text):
        tags.append("sem-acucar")
    if re.search(r"vegetarian|vegano|vegana|sem carne", text):
        tags.append("vegetariano")
    if tags:
        filtro["tags"] = tags
    for cat, rx in CAT_WORDS:
        if rx.search(text):
            filtro["categoria"] = cat
    mx = re.search(r"\b(?:ate|menos de|abaixo de|no maximo)\s*(?:r\$\s*)?(\d+)", text)
    if mx:
        filtro["preco_max"] = int(mx.group(1))
    cheap = re.search(r"\b(barat\w*|economic\w*)\b", text) is not None
    sold_out = re.search(r"\b(esgotad\w*|acabou|indisponiv\w*|em falta|nao tem mais)\b", text) is not None
    if found and found[0]["item"]["id"] == "suco-laranja" and "laranja" not in text:
        found = []
        filtro["categoria"] = filtro.get("categoria") or "sucos"
    if found:
        filtro["busca"] = found[0]["item"]["name"]
    generic = re.search(r"\b(cardapio|menu|o que tem|que tem|opcoes|hoje|disponivel|disponiveis|tem o que|o que voces tem)\b", text) is not None
    if filtro.get("tags") or filtro.get("categoria") or filtro.get("busca") or filtro.get("preco_max") or cheap or sold_out or wants_price or generic:
        if sold_out and not found:
            out = [i for i in menu if not i["available"]]
            call("buscar_cardapio", {"apenas_indisponiveis": True}, f"{len(out)} itens")
            return reply("Esgotado hoje: " + ", ".join(i["name"] for i in out) + "." if out else "Tudo disponível hoje.")
        lst = [i for i in avail if (not filtro.get("tags") or all(t in i["tags"] for t in filtro["tags"])) and (not filtro.get("categoria") or i["cat"] == filtro["categoria"])
               and (not filtro.get("busca") or i["name"] == filtro["busca"]) and (not filtro.get("preco_max") or i["price"] <= filtro["preco_max"])]
        if cheap:
            lst = sorted(lst, key=lambda i: i["price"])[:4]
            filtro["ordenar"] = "preco"
        filtro["apenas_disponiveis"] = True
        call("buscar_cardapio", dict(filtro), f"{len(lst)} itens")
        if found and not found[0]["item"]["available"]:
            return reply(f"{found[0]['item']['name']} está esgotado hoje. Quer ver outras opções?")
        if not lst:
            return reply("Não encontrei itens disponíveis com esse filtro hoje.")
        attach.append({"type": "items", "ids": [i["id"] for i in lst]})
        if wants_price and found:
            return reply(f"{found[0]['item']['name']} custa {brl(found[0]['item']['price'])}.")
        ft = filtro.get("tags")
        if ft and len(ft) == 2:
            lead = "Sem açúcar e vegetarianos hoje:"
        elif ft and ft[0] == "sem-acucar":
            lead = "Sem açúcar hoje:"
        elif ft:
            lead = "Vegetarianos hoje:"
        elif filtro.get("preco_max"):
            lead = f"Até {brl(filtro['preco_max'])}:"
        elif cheap:
            lead = "Os mais baratos de hoje:"
        elif filtro.get("busca"):
            lead = "Temos:"
        elif filtro.get("categoria"):
            lead = f"Disponíveis em {filtro['categoria']}:"
        else:
            lead = "Disponível hoje:"
        return reply(lead)

    # 10) conversa geral
    if re.search(r"\b(pag\w*|maquininha|pix|cartao|dinheiro)\b", text):
        return reply("O pagamento é na maquininha, no balcão. Gere o ticket no app e mostre o QR ao atendente.")
    if re.search(r"\b(horario|abre|fecha|funciona|aberto)\b", text):
        return reply("A Cantina FAESA do Bloco B funciona das 7h às 21h, de segunda a sábado.")
    return reply('Não entendi. Tente, por exemplo, "quero um misto e um suco", "o que tem sem açúcar?", "status do meu pedido" ou "sugira um combo".')
