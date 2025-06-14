# VARIABLES
export PROOT=$(shell pwd)
export BINARIES=${PROOT}/node_modules/.bin

export VERSION=1.11.0
export ID=lol.lolodotzip.crunchywebos
export HOMEPAGE="https://lolodotzip.lol/"
export THUMBNAIL="https://raw.githubusercontent.com/mateussouzaweb/crunchyroll-webos/master/src/images/80px.png"

# DEV METHODS
build:
	compactor \
		--source $(PROOT)/src/ \
		--destination $(PROOT)/dist/ \
		--compress false \
		--progressive false \
		--hashed false \
	&& rollup --config $(PROOT)/rollup.config.js \
	&& sed -i 's/type="module"/defer="defer"/g' $(PROOT)/dist/index.html

develop:
	compactor \
		--develop true \
		--source $(PROOT)/src/ \
		--destination $(PROOT)/dist/

# TV METHODS
devices:
	$(BINARIES)/ares-setup-device -list

setup:
	$(BINARIES)/ares-setup-device

check:
	$(BINARIES)/ares-install --list

# APP METHODS
package:
	cp -r $(PROOT)/dist/ $(PROOT)/$(ID)/ \
	&& $(BINARIES)/ares-package \
		$(PROOT)/$(ID) \
		--no-minify \
		--outdir $(PROOT)/bin \
	&& rm -r $(PROOT)/$(ID)

manifest:
	$(BINARIES)/webosbrew-gen-manifest \
		-a $(PROOT)/src/appinfo.json \
		-p $(PROOT)/bin/$(ID)_$(VERSION)_all.ipk \
		-o $(PROOT)/bin/webosbrew.manifest.json \
		-i $(THUMBNAIL) -l $(HOMEPAGE)

install:
	$(BINARIES)/ares-install $(PROOT)/bin/$(ID)_$(VERSION)_all.ipk

launch:
	$(BINARIES)/ares-launch $(ID)

inspect:
	$(BINARIES)/ares-inspect --app $(ID) --host-port 9222
