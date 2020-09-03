#!/usr/bin/env python3

# Valid for Python 3.6+

import struct
import binascii
import json

data_buf = '22617c5e01000000ed600008e00014400119f01baa244716e712d5140f150f15791356207d4c402e911d4b4b4b47161993171014701047164114e7128b0c250ef6104911ab13d514631105146d119402ce100f153310e810030c89097913f8124c0e2f1276105613b0130a13c212d111bc116c0c22131116c811cb119a10060dfd109d1422143314d111d011ec117b14a10cef0c3d0dbf11e814821032101f1245154914381283158014ae0f47126c148712d111420f7b0f6c10790d2912a312a61257109e10d2142e132f14fa13b813e3139d0cc10ed510290fad13df108510840fc70f511193108e0fa50caf121112e608241309156f0fde0e5311cd13d41264131e14f0126c0c030cd3113d104b0cce111b14510f4b0b5c08c610e71302138111f90f9f0f1a135f1481146a114a10c70e6f0ef50c4d0e590ece10af124913c5110700d610af0d5d07890c7e0f870e5b0f3410f910660d750e400eb411e3138b11a20ed50e0f14471440123710050d5a0da90d340f770c010c100b0510a60dbc0fee0eeb08fe04320c0011f910880c7f0cca128e10dd104b111111e814381793144c08c411061271108b124f14870fdf148b13f10944139413fc0a2a13360e0e0f38140f1148153a132816c31868190e1a9d1a2a1d781d471e941f621f571e091eba203423072410246724732419249a23f92282228122a422e1228e23102424245d24aa24a1242e24482359228821181f3d1ebf1eac1f551d911c971ea51c9e1bff1ae51b461b6e16b613b6154315e2131d1134115312eb0ed00deb120a12db0e0f0ea70ccc116213f2116d0b540c2b0cbb0f1e1233102713f8128314b6130a0f3f07a6129012670dad0d0f0e0c111010cf0e421197129f0d4c10b70d0f0b15125513a1100b08d10dd80fbc0ac60ec4117908651347119e0aaa0c930cc70acf0d020a6504e50fbb12f8127613ee0b8a103c109b0d9b0eff1066108d0f590f3a0ab202140e740f121257113610e40ea90fb010730d4b0a5d0ed40afc0f5d12ff0e0c0b3f10b01342117d129d11ac0fd30e940db10f550fb00b0509f3044410f30e4d0ef10a280d9b09f00df6112f115008130cf40ac906790e341119100a0e3a0b220cbe0fe80f200f700be0004e09070b490e450f3b0d040e1705f70d1810880cc80e5001ed0c2110590ca80d5d0d570f330b6c103711a00e1711c6102c10d60c78104811ce1030142e0dde149e1474143b12b5150f1554179a131815d715f018141861163f18b01a85180f19571bda1a911c281cae19ef19c6186818b519671b291d6c1d651f56204f200820841e461d491c011b4e1ae7185d19431ce31dc01d441d301d081d111db11d981e841e791dde1c7c1c241d3f1e731e7a1e391ecb1ef21f0120901f6d1e681c271b201b9a1ae91aea1a2719fe18b11aa71a351a4e1aaf18f816261866153e18ab188c156c152d14a116671784171117df157918e0132b13f312610f6a124412f210410f7110ad161f172e121f08c4104014a712590daf088d0aab0a1d10710f600d3111551186067901a707580c52096d0cb2107d0e660c2b0ca3077b0d000ff305720e3010ad0d120a4f0c37105a11450f74104b08220a64098c0c4609740fc708ae08b00ee90d0f0d21105f0e9d0c790b070d4f0b000fb40f570cc00e6f0e5b0c3407070d3709d50db5092407a40ded0ef80de60d760d6d0dae0a8c0f460c650b6c08a908170d8b0f3b1058112610fa0bd709ac0b910aa60a040b75061d0b1807e6083c0c9c0d740e0407f107f208d50e860fa5096a08e3084903db0fff0dd410100e090cb206680c24123707fc112606df0f130e280c7206ba0cd70c840ae00dea0d3210ac086011a512280c9b12d5132a11a40e2214b21154140012171213147114ad13ce0eff12a80d5a111314cb103d13f314af1689182518091646180d19111806161b172b1785159612b11194133c1476116e0de011b9147014ab12c01222133813ef15a817c816431609164015f014741504161915f6147415a4144f1354102411701370142b1449157516641845182f187e1660156914771401124112ea111410b0125f0f571042118c130d126d1338158d136311fa0cfe10210d940ea11145119f0e1d0e03097c102e0f6410e9109e0557108511e40ffe0d78104f11b70da20c3010cb1309117e10340cac0e850eb2102d0ec00c440d8310f7115b0b5e0c3209b5106a157113c70e1f0f250dcd069f0f3813cd11630e6909b20c8d0dea0bd50d6f0d3d0cca08ea0c640cd60c6a0b0c0bc9083706340ddf0dae099508f10cfd097300a7058508f10a7f0f3110a00d3f0d1310c90cf9013a0d05100c0dcc0c4c10da0cb20bf80aaa06bb0c780a87047a078904550cef0cba0be70a7b0b220da50c19107d11260db60bb60c250fa60b1f0c810dbf0b5707d3091b09681171125c0dba07cb0c7c0b260ad50e5811900d2a09220d8f078011e3106d03fc07ed05ce0e371050104a0e590d9a05540e380f5c07a70c040db80bd70eb108000f3e11c30f0a0cd709f10c550d1b0c2c10750fe60e110f39119112c7128812671378127812f810690d280f5c0d110b570efc109f100b109c0df31180110f10730c6105a10b010f3e0e700d5c0efc103f115811a310030d960d4312b0127811cb0f041048115f11d3106710ec10f70e930c240cb70fbe11b710420d3e060508920ca80f0a1204142e14a4139e111c1089102c113c10b90852098e0ff70d270b6a0bf3026b08a60b950aea054b0d520b1f11f811260c5410c410e90b020b1e0c0e003a0c120c0a0d380be105c40bf70b730cac0dfe0f3e0fe80abb0b940d7b07550afa0cf105390c3b0ad80dfd0caf08cf0f570c3b055f05720cf208600a680d1409710e6309b601310b800ece061f0b5503730ae802600b9309bd07b007b50c290ed70c5e093f050b0ef40dee0b1901f20c450fb00c4908c30f1b1139113f0b510e3c10e20c0609500c6b0bca0d6a103a0e1d06250e330c2f0b9f0dec0d430ccf0b750c410b950ab10a220c8e061609e40bd20aa80dc008c904e60a780ebd0de709fa090e09670d65061408070bf21041105d09320b620d74119c0f4209110e420cd50dab0cb109840dfe075b09510abf07960de00e470acd063807ab0ade078c0200086e08db073a0409088a0a520a8602fd0b7a095d0b0f05870c150fcd0caa0a350dbf0b430b0d0d3e0d2e0c880c3e0f0e10120e6209a6099d0c2b0d0109f50cd50d660bbb0a5e0e810db30af804c20b810ade0afc080805b70a880caa0aef08230934063f0a830dee0f6b0ea70bcc0cf60dd80ded0c7309780bb60d780c770c8710630e94067208ba040e0c4f0ccc0c250a9d09850aed09720c3c0d3f0f68109b0dab0db10cba0d2f0fab0a9d0905012609b0082d0bea032a08cc0a600ccf04840a3b08ab0a0f0ed50b0408740cf90b830b4d0e100da903840f030fd706b40de60faf0a350ddf0cf5073b0a700c510a2406350bd10d7c0af80df20c410a1c05ec032706860ad607c508ce0ac30c860dd40a1e07be03b005ef05e704a40c810c7c0a7d0c6d0cc409000b2d07ea0d8108d30b980dcc085108c108a909060aea098f0b6a0b8009900a320c900f1f0ee7095d0cf50ee109f308860b6b064c08a50c5b0c870b07055f003a09200c5d08f409e700330a850918007a07c5009206ee004a0dcd0b9607c6054b0b3108cf0a650deb09e6079a0cca0e290e3403620c290cc908fb095108c606b20a67062f08990c180d4906bb0c200d44086908e9078e09a60cde0b1408060abb0a26088b087a0d180dc106aa0c8f0c6e03610b730aa90862089d0a1c0b990515066e05370af70c790c8d09ca08210d010c7909490b230b050b7d001009be0bec053e09c60b6a08e6058c0b7f090108470401067a0bc10977064f0559052009ae0a2e07a105450141058f0a610c030a130d190a940ce60c830d5e09550945084b049a084209b808a805820b030c9409e5034a0a6e0dff0a6e04910db00c390a3e080c0caa0ad1083d08230acd0812093a0b110d460b4107f0068b082d049f09ed05eb04b505ed021509ef0b210ad5086d09c40a5203ae06e406bd073b03aa069c0427056d085f00e9023f08230b7f09530b1809c00906087807b90a7e008d0611065d09000a0c07ff09810f950e700ba60c030d040aa60b780cdb057b084a0101042c0681004d0889093008000a0c0a410bff08c803e90ae60cb20ca9076d066509020a6709d809a4091006790ad2093506f20c690c9907eb09f808fd03a8082a075909830c8d073109b7067c00f107f30b1b0cb509b208d0053802bf068c0bf30a47064904010c5a0c6d0c14093907f300e404e20392077009aa08b30c960c62099405fd07f7084d0ce90964027a083a0abf088b08b60c1e0d2109180acb0b7709530ae30a2d0ee1095c0b7d0da80a75061009210b2a0b9e0cc30ca50ce30c0d0c8a041f0ab10caa0a7c02f706130cc20bc308a2058209a30a5f05c50066067008360698040806ad0ad509f60d24080f09aa07b80d630c030ce90a780bbb0c580b84099a08240930089d0a2f097008d0087d02ac040205fb017e003e044900b014c0190c178c04bb06f2087f082904af05c20ab90a1a0a28071e0c6c0c08096e0998088108e20b1a0924099e07180c170c4609d105b5024708800a5c07fd054709cb08150a0804260b740ba708380788083c069b07e1091e0daf0b83046a0758078409860b130ce50c3c0afd07d70919095209360cc7097909bd072e086204790c3d0dd909bb0a3b0c1b08150a2b0a680c050bd708350ac405420e850e360a840aed08f5076206c006d10602076306b60ac4074b04b509220ce306bf05a3000c075c08b602fb069c08910569031e024808390a700b7008bd053d068403cd03d9044a06da00bf077f097706ea09120dea04f308310b89094403da015406cd02fb09c4087b084c035200c3070d0985056505c8066c08c00ac907c0095306360472085d0a5d088c0120054509490b9d0915066b0916095108d806c208f105f607590808074009bd080808e005d8055f072d09ad087c087c07f3087304fd0874080b0c490afd09f10cdc0b1c088e049d046802d9054100c3051f071a0988095d0aa30853057205810ad508fa0981083a0805055f0407025807d20aa70c7c061905e10a87081c0b490b24060e0403094b0ac0041708df07b50a3d084c0cbc05090c03052205ba062e0a910d630d5404b208730c2d0cee0ae80c23060d004d0b820aef080d0bd405d1044205a809ce08dd09e009f706c108990a3209c30791070e05a809350920030202dc05040827052f07ec0901060a09940746033b064a08cc0af60b93077d08890b080c3b093e0894032c099f079b06fa0044043f0c430c9f088308f1044d0479083c0aea0a2709d9063d0b410cee069e08280bbd0851067706e009550b46088c06e9086f0aa9057909a20912004e045d09e509a3028506cb07a0089e08c4072f096b09de072a0cca0aeb081b0cf308ca087f0cf10cb60a6904cf07280a090679085005390721047004db089a08f909440bea0a6b055703ab029f087f0c8c0c9b07e00ae706ba030c09ab08a90278039805c902f000a4063b08620ad10b95047608b90b5b0a1707de050e04ce07230baa0b6805680a6b08ce0961088e0816049308cd042408c803aa06ca0a0c0a40098a07660385081d0c47079505b8084b0815087e0500046606280620007f0d'
fft_data = struct.unpack_from('36s2030e', binascii.a2b_hex(data_buf))
fft_decoded = fft_data[1:]

data = {
    'data_buf': data_buf,
    'fft_decoded': fft_decoded
}

print(json.dumps(data))