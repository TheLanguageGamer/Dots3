#include "Engine.h"
#include "words2.h"
#include <set>
#include <random>
#include <unordered_map>

std::random_device rd;
std::mt19937 rng(rd()); 

enum Language
{
	Language_None = 0,
	Language_English = 1,
	Language_Spanish = 2,
	Language_German = 3,
	Language_Russian = 4,
	Language_Chinese = 5,
};

struct EnumClassHash
{
    template <typename T>
    std::size_t operator()(T t) const
    {
        return static_cast<std::size_t>(t);
    }
};

struct WordImage
{
	const std::string filename;

	WordImage(
		const std::string& filename,
		std::unordered_map<Language, std::string, EnumClassHash> translations)
	: filename(filename)
	, translations(translations)
	{

	}

	std::string getTranslation(Language language) const
	{
		if (translations.find(language) != translations.end())
		{
			return translations.at(language);
		}
		else if (translations.find(Language_English) != translations.end())
		{
			//assert false?
			return translations.at(Language_English);
		}
		//assert false;
		return "UNDEFINED";
	}
private:
	std::unordered_map<Language, std::string, EnumClassHash> translations;
};

const uint32_t wordImagesCount = 43;
const WordImage wordImages[wordImagesCount] = {
	WordImage(
		"desk.svg",
		{
			{Language_English, "desk"},
			{Language_German, "Schreibtisch"},
		}),
	WordImage(
		"corn.svg",
		{
			{Language_English, "corn"},
			{Language_German, "Mais"},
		}),
	WordImage(
		"airplane.svg",
		{
			{Language_English, "airplane"},
			{Language_German, "Flugzeug"},
		}),
	WordImage(
		"ambulance.png",
		{
			{Language_English, "ambulance"},
			{Language_German, "Krankenwagen"},
		}),
	WordImage(
		"avocado.png",
		{
			{Language_English, "avocado"},
			{Language_German, "Avocado"},
		}),
	WordImage(
		"bananas.svg",
		{
			{Language_English, "bananas"},
			{Language_German, "Bananen"},
		}),
	WordImage(
		"bed.svg",
		{
			{Language_English, "bed"},
			{Language_German, "Bett"},
		}),
	WordImage(
		"bicycle.png",
		{
			{Language_English, "bicycle"},
			{Language_German, "Fahrrad"},
		}),
	WordImage(
		"boat.png",
		{
			{Language_English, "boat"},
			{Language_German, "Boot"},
		}),
	WordImage(
		"broccoli.png",
		{
			{Language_English, "broccoli"},
			{Language_German, "Brokkoli"},
		}),
	WordImage(
		"bus.svg",
		{
			{Language_English, "bus"},
			{Language_German, "Bus"},
		}),
	WordImage(
		"car.png",
		{
			{Language_English, "car"},
			{Language_German, "Auto"},
		}),
	WordImage(
		"chair.png",
		{
			{Language_English, "chair"},
			{Language_German, "Stuhl"},
		}),
	WordImage(
		"cherries.svg",
		{
			{Language_English, "cherries"},
			{Language_German, "Kirschen"},
		}),
	WordImage(
		"coconut.png",
		{
			{Language_English, "coconut"},
			{Language_German, "Kokosnuss"},
		}),
	WordImage(
		"drum_set.svg",
		{
			{Language_English, "drum set"},
			{Language_German, "Schlagzeug"},
		}),
	WordImage(
		"fire_truck.png",
		{
			{Language_English, "fire truck"},
			{Language_German, "Feuerwehrauto"},
		}),
	WordImage(
		"garlic.png",
		{
			{Language_English, "garlic"},
			{Language_German, "Knoblauch"},
		}),
	WordImage(
		"ginger.png",
		{
			{Language_English, "ginger"},
			{Language_German, "Ingwer"},
		}),
	WordImage(
		"grapes.svg",
		{
			{Language_English, "grapes"},
			{Language_German, "Trauben"},
		}),
	WordImage(
		"guitar.png",
		{
			{Language_English, "guitar"},
			{Language_German, "Gitarre"},
		}),
	WordImage(
		"helicopter.png",
		{
			{Language_English, "helicopter"},
			{Language_German, "Hubschrauber"},
		}),
	WordImage(
		"kiwi.png",
		{
			{Language_English, "kiwi"},
			{Language_German, "Kiwi"},
		}),
	WordImage(
		"lamp.png",
		{
			{Language_English, "lamp"},
			{Language_German, "Lampe"},
		}),
	WordImage(
		"lemon.png",
		{
			{Language_English, "lemon"},
			{Language_German, "Zitrone"},
		}),
	WordImage(
		"mango.png",
		{
			{Language_English, "mango"},
			{Language_German, "Mango"},
		}),
	WordImage(
		"motorcycle.png",
		{
			{Language_English, "motorcycle"},
			{Language_German, "Motorrad"},
		}),
	WordImage(
		"mushroom.svg",
		{
			{Language_English, "mushroom"},
			{Language_German, "Pilz"},
		}),
	WordImage(
		"orange.png",
		{
			{Language_English, "orange"},
			{Language_German, "Orange"},
		}),
	WordImage(
		"pear.svg",
		{
			{Language_English, "pear"},
			{Language_German, "Birne"},
		}),
	WordImage(
		"piano.png",
		{
			{Language_English, "piano"},
			{Language_German, "Klavier"},
		}),
	WordImage(
		"pineapple.png",
		{
			{Language_English, "pineapple"},
			{Language_German, "Ananas"},
		}),
	WordImage(
		"police_car.svg",
		{
			{Language_English, "police car"},
			{Language_German, "Polizeiauto"},
		}),
	WordImage(
		"potato.png",
		{
			{Language_English, "potato"},
			{Language_German, "Kartoffel"},
		}),
	WordImage(
		"red_apple.svg",
		{
			{Language_English, "apple"},
			{Language_German, "Apfel"},
		}),
	WordImage(
		"sofa.png",
		{
			{Language_English, "sofa"},
			{Language_German, "Sofa"},
		}),
	WordImage(
		"spaceship.png",
		{
			{Language_English, "spaceship"},
			{Language_German, "Raumschiff"},
		}),
	WordImage(
		"strawberry.png",
		{
			{Language_English, "strawberry"},
			{Language_German, "Erdbeere"},
		}),
	WordImage(
		"table.png",
		{
			{Language_English, "table"},
			{Language_German, "Tisch"},
		}),
	WordImage(
		"tomato.png",
		{
			{Language_English, "tomato"},
			{Language_German, "Tomate"},
		}),
	WordImage(
		"train.svg",
		{
			{Language_English, ""},
			{Language_German, ""},
		}),
	WordImage(
		"truck.png",
		{
			{Language_English, "truck"},
			{Language_German, "Lastwagen"},
		}),
	WordImage(
		"violin.svg",
		{
			{Language_English, "violin"},
			{Language_German, "Geige"},
		}),





	// WordImage(
	// 	"",
	// 	{
	// 		{Language_English, ""},
	// 		{Language_German, ""},
	// 	}),
};

std::string languageName(Language language)
{
	switch (language)
	{
		case Language_None: return "None";
		case Language_English: return "English";
		case Language_German: return "German";
		case Language_Chinese: return "Chinese";
		case Language_Spanish: return "Spanish";
		case Language_Russian: return "Russian";
	}
}

std::string translateInteger(uint32_t value, Language language)
{
	if (language == Language_English)
	{
		switch (value)
		{
			case 0: return "zero";
			case 1: return "one";
			case 2: return "two";
			case 3: return "three";
			case 4: return "four";
			case 5: return "five";
			case 6: return "six";
			case 7: return "seven";
			case 8: return "eight";
			case 9: return "nine";
			case 10: return "ten";
			case 11: return "eleven";
			case 12: return "twelve";
		}
	}
	else if (language == Language_German)
	{
		switch (value)
		{
			case 0: return "null";
			case 1: return "eins";
			case 2: return "zwei";
			case 3: return "drei";
			case 4: return "vier";
			case 5: return "fünf";
			case 6: return "sechs";
			case 7: return "sieben";
			case 8: return "acht";
			case 9: return "neun";
			case 10: return "zehn";
			case 11: return "elf";
			case 12: return "zwölf";
			case 13: return "dreizehn";
			case 14: return "vierzehn";
			case 15: return "fünfzehn";
			case 16: return "sechzehn";
			case 17: return "siebzehn";
			case 18: return "achtzehn";
			case 19: return "neunzehn";
			case 20: return "zwanzig";
		}
	}
	else if (language == Language_Chinese)
	{
		switch (value)
		{
			case 0: return "零";
			case 1: return "一";
			case 2: return "二";
			case 3: return "三";
			case 4: return "四";
			case 5: return "五";
			case 6: return "六";
			case 7: return "七";
			case 8: return "八";
			case 9: return "九";
			case 10: return "十";
			case 11: return "十一";
			case 12: return "十二";
			case 13: return "十三";
			case 14: return "十四";
			case 15: return "十五";
			case 16: return "十六";
			case 17: return "十七";
			case 18: return "十八";
			case 19: return "十九";
			case 20: return "二十";
		}
	}
	else if (language == Language_Spanish)
	{
		switch (value)
		{
			case 1: return "uno";
			case 2: return "dos";
			case 3: return "tres";
			case 4: return "cuatro";
			case 5: return "cinco";
			case 6: return "seis";
			case 7: return "siete";
			case 8: return "ocho";
			case 9: return "nueve";
			case 10: return "diez";
			case 11: return "once";
			case 12: return "doce";
			case 13: return "trece";
			case 14: return "catorce";
			case 15: return "quince";
			case 16: return "dieciséis";
			case 17: return "diecisiete";
			case 18: return "dieciocho";
			case 19: return "diecinueve";
			case 20: return "veinte";
		}
	}
	else if (language == Language_Russian)
	{
		switch (value)
		{
			case 1: return "один";
			case 2: return "два";
			case 3: return "три";
			case 4: return "четыре";
			case 5: return "пять";
			case 6: return "шесть";
			case 7: return "семь";
			case 8: return "восемь";
			case 9: return "девять";
			case 10: return "десять";
			case 11: return "одиннадцать";
			case 12: return "двенадцать";
			case 13: return "тринадцать";
			case 14: return "четырнадцать";
			case 15: return "пятнадцать";
			case 16: return "шестнадцать";
			case 17: return "семнадцать";
			case 18: return "восемнадцать";
			case 19: return "девятнадцать";
			case 20: return "двадцать";
		}
	}
	char buff[16];
	sprintf(buff, "%d", value);
	return buff;
}

enum GameMode
{
	GameMode_Color,
	GameMode_Spelling,
	GameMode_Math,
	GameMode_Vocabulary,
};

struct Tile : RoundedRectangleComponent
{
	std::shared_ptr<TextComponent> label = nullptr;
	std::shared_ptr<ImageComponent> image = nullptr;

	Tile(std::vector<Entity>& entities, GameMode mode)
	: RoundedRectangleComponent(entities, 18.0, 6.0, 0xFFFFFF00, 0x226699FF)
	{
		if (mode == GameMode_Vocabulary)
		{
			image.reset(new ImageComponent(entities, "desk.svg"));
			image->setRelativeSize(entities, Vector2(0.8, 0.8));
			image->setAnchorPoint(entities, Vector2(0.5, 0.5));
			image->setRelativePosition(entities, Vector2(0.5, 0.5));

			addChild(entities, image);
		}
		if (mode == GameMode_Spelling || mode == GameMode_Math || mode == GameMode_Vocabulary)
		{		
			label.reset(new TextComponent(entities, "A", 0xFFFFFF00, 18.0f));
			label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
			label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
			label->setRelativeSize(entities, Vector2(0.7, 1.0));

			addChild(entities, label);
		}
	}
};

struct Configuration
{
	Language language = Language_None;
	uint32_t highlightColor = 0xFFFFFFFF;
	Vector2Int gridSize = Vector2Int(2, 1);

	virtual uint32_t chooseState(
		std::shared_ptr<ComponentGrid> board,
		uint32_t row, uint32_t column) = 0;
	virtual void didSetState(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell) = 0;
	virtual void willRemoveCell(std::shared_ptr<ComponentCell> cell) = 0;
	virtual void didDeselect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel) = 0;
	virtual void didSelect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel) = 0;
	virtual bool canSelect(
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell) = 0;
	virtual bool shouldAcceptSelected(std::vector<std::shared_ptr<ComponentCell>> selected) = 0;
	virtual void didClearSelected() = 0;
};

struct VocabularyConfiguration : Configuration
{
	struct WordImageUse
	{
		uint32_t wordImageIndex = 0;
		uint32_t totalExposures = 0;
		uint32_t currentlyOnBoard = 0;
		uint32_t exposuresThisSession = 0;
		bool showImage = false;
	};
	std::vector<WordImageUse> wordImageUsages;
	std::vector<uint32_t> currentWordImages;

	VocabularyConfiguration()
	: wordImageUsages(wordImagesCount)
	, currentWordImages(3)
	{
		highlightColor = 0x33FF77;
		gridSize = Vector2Int(4, 4);

		for (uint32_t i = 0; i < wordImagesCount; ++i)
		{
			static std::uniform_int_distribution<uint32_t> dist(0, 1);
			bool showImage = dist(rng);
			wordImageUsages[i].wordImageIndex = i;
			wordImageUsages[i].showImage = showImage;
		}
		for (uint32_t i = 0; i < currentWordImages.size(); ++i)
		{
			currentWordImages[i] = i;
		}
	}

	uint32_t chooseState(
		std::shared_ptr<ComponentGrid> board,
		uint32_t row, uint32_t column)
	{
		std::uniform_int_distribution<uint32_t> dist(0, currentWordImages.size()-1);
		uint32_t state = currentWordImages[dist(rng)];
		return state;
	}
	void didSetState(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell)
	{
		// static std::uniform_int_distribution<uint32_t> dist(0, 1);
		// bool showImage = dist(rng);


		wordImageUsages[cell->state].currentlyOnBoard++;
		wordImageUsages[cell->state].totalExposures++;

		const WordImage& wordImage = wordImages[cell->state];
		auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
		tile->setFillColor(entities, 0xFFFFFFFF);

		if (wordImageUsages[cell->state].showImage)
		{
			tile->image->enable(entities);
			tile->image->setImage(entities, wordImage.filename);
			tile->label->disable(entities);
		}
		else
		{
			printf("label %s\n", wordImage.getTranslation(language).c_str());
			tile->image->disable(entities);
			tile->label->enable(entities);
			tile->label->setFillColor(entities, 0x000000FF);
			tile->label->setText(entities, wordImage.getTranslation(language));
		}
		wordImageUsages[cell->state].showImage = !wordImageUsages[cell->state].showImage;
	}
	void selectNewWordImage()
	{
		int32_t best = -1;
		uint32_t argBest = 0;
		for (uint32_t i = 0; i < wordImagesCount; ++i)
		{
			const WordImageUse& wordImageUse = wordImageUsages[i];
			if (wordImageUse.currentlyOnBoard != 0)
			{
				continue;
			}
			if (wordImageUse.totalExposures < best || best == -1)
			{
				best = wordImageUse.totalExposures;
				argBest = i;
			}
		}
		currentWordImages.push_back(argBest);
	}
	void willRemoveCell(std::shared_ptr<ComponentCell> cell)
	{
		wordImageUsages[cell->state].currentlyOnBoard--;
		//printf("currentlyOnBoard %u %u\n", cell->state, wordImageUsages[cell->state].currentlyOnBoard);
		if (wordImageUsages[cell->state].currentlyOnBoard == 0)
		{
			currentWordImages.erase(
				std::remove(currentWordImages.begin(), currentWordImages.end(), cell->state),
				currentWordImages.end()
			);
			printf("removed: %u, new size: %lu\n", cell->state, currentWordImages.size());
			while(currentWordImages.size() < 3)
			{
				selectNewWordImage();
			}
			printf("after selecting, new size: %lu\n", currentWordImages.size());
		}
	}
	void didDeselect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{

	}
	void didSelect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{

	}
	bool canSelect(
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell)
	{
		if (selected.size() == 0
			|| selected[0]->state == cell->state)
		{
			return true;
		}
		return false;
	}
	bool shouldAcceptSelected(std::vector<std::shared_ptr<ComponentCell>> selected)
	{
		return selected.size() > 1;
	}
	void didClearSelected()
	{

	}
};

struct ColorConfiguration : Configuration
{
	ColorConfiguration()
	{
		gridSize = Vector2Int(8, 6);
	}
	uint32_t chooseState(
		std::shared_ptr<ComponentGrid> board,
		uint32_t row, uint32_t column)
	{
		static const std::vector<const uint32_t> colors({
			0xFF0000FF,
			0x00FF00FF,
			0x0000FFFF,
		});
		static std::uniform_int_distribution<uint32_t> dist(0, colors.size()-1);
		uint32_t index = dist(rng);

		return colors[index];
	}
	void didSetState(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell)
	{
		auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
		tile->setFillColor(entities, cell->state);
	}
	void willRemoveCell(std::shared_ptr<ComponentCell> cell)
	{

	}
	void didDeselect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{

	}
	void didSelect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{

	}
	bool canSelect(
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell)
	{
		if (selected.size() == 0
			|| selected[0]->state == cell->state)
		{
			return true;
		}
		return false;
	}
	bool shouldAcceptSelected(std::vector<std::shared_ptr<ComponentCell>> selected)
	{
		return selected.size() > 2;
	}
	void didClearSelected()
	{

	}
};

struct MathConfiguration : Configuration
{
	enum Type
	{
		Type_Number = 0,
		Type_Plus,
		Type_Minus,
		Type_Multiply,
		Type_Divide,
	};
	struct Node
	{
		Type type = Type_Number;
		int32_t value = 0;

		Node(Type type, int32_t value = 0)
		: type(type), value(value) {}

		std::string display(Language language) const
		{
			if (language == Language_English)
			{
				switch (type)
				{
					case Type_Number:
					{
						return translateInteger(value, language);
					}
					case Type_Plus:
					{
						return "plus";
					}
					case Type_Minus:
					{
						return "minus";
					}
					case Type_Multiply:
					{
						return "times";
					}
					case Type_Divide:
					{
						return "divided by";
					}
				}
			}
			else if (language == Language_German)
			{
				switch (type)
				{
					case Type_Number:
					{
						return translateInteger(value, language);
					}
					case Type_Plus:
					{
						return "plus";
					}
					case Type_Minus:
					{
						return "minus";
					}
					case Type_Multiply:
					{
						return "mal";
					}
					case Type_Divide:
					{
						return "geteilt durch";
					}
				}
			}
			else if (language == Language_Chinese)
			{
				switch (type)
				{
					case Type_Number:
					{
						return translateInteger(value, language);
					}
					case Type_Plus:
					{
						return "加";
					}
					case Type_Minus:
					{
						return "减";
					}
					case Type_Multiply:
					{
						return "乘以";
					}
					case Type_Divide:
					{
						return "除以";
					}
				}
			}
			else if (language == Language_Spanish)
			{
				switch (type)
				{
					case Type_Number:
					{
						return translateInteger(value, language);
					}
					case Type_Plus:
					{
						return "más";
					}
					case Type_Minus:
					{
						return "menos";
					}
					case Type_Multiply:
					{
						return "por";
					}
					case Type_Divide:
					{
						return "dividido";
					}
				}
			}
			else if (language == Language_Russian)
			{
				switch (type)
				{
					case Type_Number:
					{
						return translateInteger(value, language);
					}
					case Type_Plus:
					{
						return "плюс";
					}
					case Type_Minus:
					{
						return "минус";
					}
					case Type_Multiply:
					{
						return "умножить на";
					}
					case Type_Divide:
					{
						return "делится на";
					}
				}
			}
			else
			{
				switch (type)
				{
					case Type_Number:
					{
						char buff[16];
						sprintf(buff, "%d", value);
						return buff;
					}
					case Type_Plus:
					{
						return "+";
					}
					case Type_Minus:
					{
						return "-";
					}
					case Type_Multiply:
					{
						return "*";
					}
					case Type_Divide:
					{
						return "/";
					}
				}
			}
		}

		static Node fromState(uint32_t state)
		{
			bool negative = state&0xFF00;
			int32_t value = state&0xFF;
			if (negative)
			{
				value = -value;
			}
			Type type = (Type)(state >> 16);
			return Node(type, value);
		}
		static uint32_t toState(const Node& node)
		{
			uint32_t state = ((uint32_t)node.type) << 16;
			int32_t value = node.value;
			if (value < 0)
			{
				value = -value;
				state |= 0xFF00;
			}
			state += value;
			return state;
		}
	};

	int32_t minusCount = 0;
	int32_t plusCount = 0;

	MathConfiguration()
	{
		gridSize = Vector2Int(8, 6);
	}

	bool areAdjacentCellsNonAdd(
		std::shared_ptr<ComponentGrid> board,
		uint32_t row, uint32_t column)
	{
		if (row > 0)
		{
			auto other = board->grid[row-1][column];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		if (column > 0)
		{
			auto other = board->grid[row][column-1];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		if (row < board->gridSize.y-1)
		{
			auto other = board->grid[row+1][column];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		if (column < board->gridSize.x-1)
		{
			auto other = board->grid[row][column+1];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		return true;
	}

	bool areDiagonalCellsNonAdd(
		std::shared_ptr<ComponentGrid> board,
		uint32_t row, uint32_t column)
	{
		if (row > 0 && column > 0)
		{
			auto other = board->grid[row-1][column-1];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		if (row > 0 && column < board->gridSize.x-1)
		{
			auto other = board->grid[row-1][column+1];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		if (row < board->gridSize.y-1 && column > 0)
		{
			auto other = board->grid[row+1][column-1];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		if (row < board->gridSize.y-1 && column < board->gridSize.x-1)
		{
			auto other = board->grid[row+1][column+1];
			const Node node = Node::fromState(other->state);
			if (node.type == Type_Plus || node.type == Type_Minus)
			{
				return false;
			}
		}
		return true;
	}

	uint32_t chooseState(
		std::shared_ptr<ComponentGrid> board,
		uint32_t row, uint32_t column)
	{
		static std::uniform_real_distribution<> special(0, 1);
		double s = special(rng);
		if (areAdjacentCellsNonAdd(board, row, column)
			&& areDiagonalCellsNonAdd(board, row, column))
		{
			static std::uniform_int_distribution<int32_t> op1Dist(1, 2);
			Type type = Type_Minus;
			if (minusCount < 2)
			{
				type = Type_Minus;
			}
			else if (plusCount < 2)
			{
				type = Type_Plus;
			}
			else
			{
				type = (Type)op1Dist(rng);
			}
			Node node(type);
			return Node::toState(node);
		}
		else if (areAdjacentCellsNonAdd(board, row, column) && s < 0.4)
		{
			static std::uniform_int_distribution<int32_t> op2Dist(3, 4);
			Type type = (Type)op2Dist(rng);
			Node node(type);
			return Node::toState(node);
		}
		else
		{
			//static std::uniform_int_distribution<uint32_t> dist(1, 6);
			//static std::poisson_distribution<> dist(2);
			static std::discrete_distribution<> dist({10, 16, 16, 13, 10, 7, 4, 3, 2, 1, 1, 1});
			int32_t value = dist(rng) + 1;
			Node node(Type_Number, value);
			return Node::toState(node);
		}
	}
	void didSetState(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell)
	{
		const Node node = Node::fromState(cell->state);
		if (node.type == Type_Minus)
		{
			minusCount++;
		}
		if (node.type == Type_Plus)
		{
			plusCount++;
		}
		auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
		switch (node.type)
		{
			case Type_Number:
			{
				tile->setFillColor(entities, 0x226699FF);
				break;
			}
			case Type_Minus:
			{
				tile->setFillColor(entities, 0xBB1133FF);
				break;
			}
			case Type_Plus:
			{
				tile->setFillColor(entities, 0x22AA55FF);
				break;
			}
			case Type_Multiply:
			{
				tile->setFillColor(entities, 0x222233FF);
				break;
			}
			case Type_Divide:
			{
				tile->setFillColor(entities, 0x330022FF);
				break;
			}
		}
		tile->label->setText(entities, node.display(language));
	}
	void willRemoveCell(std::shared_ptr<ComponentCell> cell)
	{
		const Node node = Node::fromState(cell->state);
		if (node.type == Type_Minus)
		{
			minusCount--;
		}
		if (node.type == Type_Plus)
		{
			plusCount++;
		}
	}
	void didDeselect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{
		double value = evaluate(selected);
		char buff[16];
		sprintf(buff, "%4.2f", value);
		marqueeLabel->setText(entities, buff);
	}
	void didSelect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{
		double value = evaluate(selected);
		char buff[16];
		sprintf(buff, "%4.2f", value);
		marqueeLabel->setText(entities, buff);
		printf("didSelect %4.2f %s\n", value, buff);
	}
	bool canSelect(
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell)
	{
		const Node node = Node::fromState(cell->state);
		if (selected.size() == 0)
		{
			return node.type == Type_Number;
		}
		const Node lastNode = Node::fromState(selected[selected.size()-1]->state);
		if (lastNode.type == Type_Number)
		{
			return node.type != Type_Number;
		}
		else
		{
			return node.type == Type_Number;
		}
		return true;
	}
	double evaluate(std::vector<std::shared_ptr<ComponentCell>> selected)
	{
		double aggregate = 0.0;
		Type lastType = Type_Plus;
		for (int32_t i = 0; i < selected.size(); ++i)
		{
			auto cell = selected[i];
			const Node node = Node::fromState(cell->state);
			if (node.type == Type_Number)
			{
				switch(lastType)
				{
					case Type_Plus:
					{
						aggregate += node.value;
						break;
					}
					case Type_Minus:
					{
						aggregate -= node.value;
						break;
					}
					case Type_Multiply:
					{
						aggregate *= node.value;
						break;
					}
					case Type_Divide:
					{
						aggregate /= node.value;
						break;
					}
					default:
					{
						break;
					}
				}
			}
			lastType = node.type;
		}
		printf("aggregate: %4.2f\n", aggregate);
		return aggregate;
	}
	bool shouldAcceptSelected(std::vector<std::shared_ptr<ComponentCell>> selected)
	{
		if (selected.size() == 0)
		{
			return false;
		}
		const Node node = Node::fromState(selected[selected.size()-1]->state);
		if (node.type != Type_Number)
		{
			return false;
		}
		double value = evaluate(selected);
		return abs(value) < 0.0001;
	}
	void didClearSelected()
	{

	}
};

struct SpellingConfiguration : Configuration
{
	std::string word = "";
	uint32_t consonantCount = 0;
	uint32_t vowelCount = 0;

	SpellingConfiguration()
	{
		gridSize = Vector2Int(8, 6);
	}

	uint32_t chooseState(
		std::shared_ptr<ComponentGrid> board,
		uint32_t row, uint32_t column)
	{
		// static const std::string vowels = "AEIOU";
		// static const std::string consonants = "BCDFGHJKLMNPQRSTVWXYZ";
		// static std::uniform_int_distribution<uint32_t> vowelDist(0, vowels.size()-1);
		// static std::uniform_int_distribution<uint32_t> consonantDist(0, consonants.size()-1);
		// static std::uniform_real_distribution<> dist(0, 1);
		// static const float targetVowelRatio = 0.37;
		// float p = dist(rng);
		// char c = '\0';
		// if (p <= targetVowelRatio)
		// {
		// 	c = vowels.at(vowelDist(rng));
		// }
		// else
		// {
		// 	c = consonants.at(consonantDist(rng));
		// }
		// return c - 'A';

		static std::discrete_distribution<> dist({9, 2, 2, 4, 12, 2, 3, 2, 9, 1, 1, 4, 2, 6, 8, 2, 1, 6, 4, 6, 4, 2, 2, 1, 2, 1});
		char c = dist(rng);
		return c;
	}
	void didSetState(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell)
	{
		char c = 'A' + (char)cell->state;
		if (c == 'A' || c == 'E' || c == 'I' || c == 'O' || c == 'U')
		{
			vowelCount++;
		}
		else
		{
			consonantCount++;
		}
		auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
		tile->setFillColor(entities, 0x226699FF);
		char buff[16];
		sprintf(buff, "%c", c);
		tile->label->setText(entities, buff);
	}
	void willRemoveCell(std::shared_ptr<ComponentCell> cell)
	{
		char c = 'A' + (char)cell->state;
		if (c == 'A' || c == 'E' || c == 'I' || c == 'O' || c == 'U')
		{
			vowelCount--;
		}
		else
		{
			consonantCount--;
		}
	}
	void didDeselect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{
		//assert word.size() > 0
		printf("didDeselect %s\n", word.c_str());
		word.pop_back();
	}
	void didSelect(
		std::vector<Entity>& entities,
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell,
		std::shared_ptr<TextComponent> marqueeLabel)
	{
		char c = 'A' + (char)cell->state;
		word += c;
		bool isCorrect = Engine_SpellCheck(word.c_str());
		printf("%c %u Word: %s, Correct: %s\n", c, cell->state, word.c_str(), isCorrect ? "YES" : "NO");
	}
	bool canSelect(
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell)
	{
		return true;
	}
	bool shouldAcceptSelected(std::vector<std::shared_ptr<ComponentCell>> selected)
	{
		return selected.size() > 2 && Engine_SpellCheck(word.c_str());;
	}
	void didClearSelected()
	{
		word = "";
	}
};

struct ConnectingTiles : Screen
{
	GameMode mode;
	std::shared_ptr<Configuration> configuration;
	std::shared_ptr<FilledRectangleComponent> background;
	std::shared_ptr<ComponentGrid> board;
	std::shared_ptr<TextComponent> marqueeLabel;
	std::shared_ptr<StrokeRectangleComponent> currentLanguageComponent = nullptr;
	std::vector<std::shared_ptr<ComponentCell>> selected;
	uint32_t selectedState;
	Language currentLanguage = Language_None;

	ConnectingTiles(GameMode mode)
	: board(nullptr)
	, selectedState(0)
	, configuration(nullptr)
	, mode(mode)
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		float sidebarHeight = 60.0f;
		auto languageMenu = std::shared_ptr<FilledRectangleComponent>(
			new FilledRectangleComponent(entities, 0xFFFFFF00));
		languageMenu->setRelativeSize(entities, Vector2(1.0f, 0.0f));
		languageMenu->setOffsetSize(entities, Vector2(0.0, sidebarHeight));
		languageMenu->positionMode = Component::PositionMode_HorizontalBlock;

		for (int32_t i = 0; i < 6; ++ i)
		{
			static const uint32_t selectedColor = 0xFFFFFFFF;
			static const uint32_t unselectedColor = 0xA0A0A0FF;

			Language language = (Language)i;

			auto container = std::shared_ptr<StrokeRectangleComponent>(
				new StrokeRectangleComponent(entities, 2.0f, i == 0 ? selectedColor : unselectedColor));
			container->setOffsetPosition(entities, Vector2(sidebarHeight/5.0f, sidebarHeight/5.0f));
			container->setOffsetSize(entities, Vector2(sidebarHeight*2, sidebarHeight*3.0f/5.0f));

			auto label = std::shared_ptr<struct Component>(
				new TextComponent(entities, languageName(language), 0xFFFFFFFF, 18.0f));
			label->setSizeMode(entities, Component::SizeMode_SizeToContents);
			label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
			label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

			container->enableClicking(nullptr, nullptr,
				[language, container, this]
				(const Vector2& position){
				if (currentLanguage == language)
				{
					return;
				}
				currentLanguage = language;
				container->setStrokeColor(entities, selectedColor);
				currentLanguageComponent->setStrokeColor(entities, unselectedColor);
				currentLanguageComponent = container;
				// winMessage->disable(entities);
				// initializeForLevel(levels[i]);
				reset();
			});
			
			container->addChild(entities, label);
			languageMenu->addChild(entities, container);

			if (language == Language_None)
			{
				currentLanguageComponent = container;
			}
		}

		background = std::shared_ptr<FilledRectangleComponent>(
			new FilledRectangleComponent(entities,0xFFFFFF00));

		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;
		background->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		background->setOffsetSize(entities, Vector2(-100.0f, -100.0f));
		background->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		background->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 8.0/5.0;

		board = std::shared_ptr<ComponentGrid>(
			new ComponentGrid(
				entities,
				Vector2Int(10, 10),
				0.25,
				nullptr,
				[this, mode]()
				{
					auto component = new Tile(entities, mode);
					component->setRelativePosition(entities, Vector2(0.5, 0.5));
					component->setAnchorPoint(entities, Vector2(0.5, 0.5));
					return component;
				},
				nullptr
			)
		);
		board->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		board->enableDrawing(
			[this](const Vector2& position)
			{
				drawingBegan(position);
			},
			[this](const Vector2& position)
			{
				drawingMoved(position);
			},
			[this](const Vector2& position)
			{
				drawingEnded(position);
			}
		);

		background->addChild(entities, board);

		auto marquee = std::shared_ptr<StrokeRectangleComponent>(
			new StrokeRectangleComponent(entities, 2.0f, 0xFFFFFFFF));
		marquee->setOffsetSize(entities, Vector2(150.0f, 50.0f));
		marquee->setRelativePosition(entities, Vector2(1.0, 0.0));
		marquee->setOffsetPosition(entities, Vector2(-25.0f, 25.0f));
		marquee->setAnchorPoint(entities, Vector2(1.0f, 0.0f));

		marqueeLabel = std::shared_ptr<TextComponent>(
			new TextComponent(entities, "0.00", 0xFFFFFFFF, 24.0f));
		marqueeLabel->setSizeMode(entities, Component::SizeMode_SizeToContents);
		marqueeLabel->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		marqueeLabel->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		//marqueeLabel->setRelativeSize(entities, Vector2(0.85f, 1.0f));

		rootComponent->addChild(entities, languageMenu);
		rootComponent->addChild(entities, background);
		marquee->addChild(entities, marqueeLabel);
		rootComponent->addChild(entities, marquee);

		reset();
	}

	void reset()
	{
		switch(mode)
		{
			case GameMode_Color:
			{
				configuration.reset(new ColorConfiguration());
				break;
			}
			case GameMode_Spelling:
			{
				configuration.reset(new SpellingConfiguration());
				break;
			}
			case GameMode_Math:
			{
				configuration.reset(new MathConfiguration());
				break;
			}
			case GameMode_Vocabulary:
			{
				configuration.reset(new VocabularyConfiguration());
				break;
			}
		}
		configuration->language = currentLanguage;
		board->resizeGrid(entities, configuration->gridSize);
		fillErUp();
	}

	void fillErUp()
	{
		static std::uniform_real_distribution<> dist(-500, 500);
		for (int32_t row = board->gridSize.y-1; row >= 0; --row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				if (board->grid[row][column])
				{
					continue;
				}
				float offset = dist(rng);
				uint32_t state = configuration->chooseState(board, row, column);
				auto cell = board->spawn(entities, row, column, state);
				deselect(row, column);
				configuration->didSetState(entities, cell);
				cell->setOffsetPosition(entities, Vector2(0.0, -1000.0+offset));
				cell->setAlpha(entities, 0xFF);
				auto animation = std::dynamic_pointer_cast<PropertyAnimation>(cell->movement);
				animation->setOffsetPosition(Vector2(0.0f, 0.0f));
				animation->disableOnComplete = false;
			}
		}
		board->relayout(entities);
	}

	void drawingBegan(const Vector2& position)
	{
		printf("drawingBegan\n");
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				if (column == 2 && row == 1)
				{
					printf("drawingBegan %4.2fx%4.2f, %4.2fx%4.2f, %4.2f, %4.2f\n",
						position.x, position.y,
						cell->screenPosition.x, cell->screenPosition.y,
						cell->screenSize.x, cell->screenSize.y);
				}
				if (!cell
					|| !doesPointIntersectRect(position, cell->screenPosition, cell->screenSize))
				{
					continue;
				}
				if (!configuration->canSelect(selected, cell))
				{
					return;
				}
				// if (cell->movement && !cell->movement->isComplete)
				// {
				// 	return;
				// }
				// board->swapToTop(entities, cell);
				// cell->selected = true;
				// auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
				// tile->setFillColor(entities, 0x229955FF);
				selected.push_back(cell);
				select(row, column);
				selectedState = cell->state;
			}
		}
	}

	bool shouldDeselectLast(uint32_t row, uint32_t column)
	{
		if (selected.size() <= 1)
		{
			return false;
		}

		uint32_t lastRow = selected[selected.size()-2]->row;
		uint32_t lastColumn = selected[selected.size()-2]->column;
		//printf("shouldDeselectLast %ux%u => %ux%u\n", row, column, lastRow, lastColumn);

		if (lastRow == row && lastColumn == column)
		{
			return true;
		}

		return false;
	}

	void deselect(uint32_t row, uint32_t column)
	{
		auto cell = board->grid[row][column];
		if (cell)
		{
			auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
			//tile->setFillColor(entities, 0x226699FF);
			tile->setStrokeColor(entities, 0xFFFFFF00);
			if (cell->selected)
			{
				configuration->didDeselect(entities, selected, cell, marqueeLabel);
			}
			cell->selected = false;
			return;
		}
	}

	void select(uint32_t row, uint32_t column)
	{
		auto cell = board->grid[row][column];
		if (cell)
		{
			board->swapToTop(entities, cell);
			auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
			//tile->setFillColor(entities, 0x229955FF);
			tile->setStrokeColor(entities, configuration->highlightColor);
			if (!cell->selected)
			{
				configuration->didSelect(entities, selected, cell, marqueeLabel);
			}
			cell->selected = true;
		}
	}

	void drawingMoved(const Vector2& position)
	{

		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				if (!cell
					|| !doesPointIntersectRect(position, cell->screenPosition, cell->screenSize))
				{
					continue;
				}
				if (shouldDeselectLast(row, column))
				{
					uint32_t dRow = selected[selected.size()-1]->row;
					uint32_t dColumn = selected[selected.size()-1]->column;
					selected.pop_back();
					deselect(dRow, dColumn);
					return;
				}
				if (cell->selected)
				{
					return;
				}
				if (selected.size() > 0
					&& !board->areAdjacent(
						row, column, selected[selected.size()-1]->row, selected[selected.size()-1]->column))
				{
					// printf("not adjacent %ux%u => %ux%u\n",
					// 	row, column, selected[0].y, selected[0].x);
					return;
				}

				if (!configuration->canSelect(selected, cell))
				{
					return;
				}

				selected.push_back(cell);
				select(row, column);
			}
		}
	}

	void drawingEnded(const Vector2& position)
	{
		if (configuration->shouldAcceptSelected(selected))
		{
			clearSelected();
		}
		else
		{
			deselectAll();
		}
	}

	void clearSelected()
	{
		for (auto cell : selected)
		{
			uint32_t row = cell->row;
			uint32_t column = cell->column;
			cell->selected = false;
			configuration->willRemoveCell(cell);
			
			auto animation = std::dynamic_pointer_cast<PropertyAnimation>(cell->movement);
			const Vector2 relativeSize = cell->getRelativeSize(entities);
			animation->setRelativeSize(Vector2(relativeSize.x*2.0, relativeSize.y*2.0));
			animation->setAlpha(0.0f);
			animation->disableOnComplete = true;
			//cell->disable(entities);

			board->grid[row][column] = nullptr;
		}
		//word = "";
		configuration->didClearSelected();
		selected.clear();
		board->fallDown(entities);
		fillErUp();
	}

	void deselectAll()
	{
		auto temp(selected);
		selected.clear();
		for (auto cell : temp)
		{
			uint32_t row = cell->row;
			uint32_t column = cell->column;
			deselect(row, column);
		}
	}
};

struct Mode1 : Screen
{
	Mode1()
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xAA88FFFF));
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game;
	std::shared_ptr<Screen> mode0 = std::shared_ptr<Screen>(new ConnectingTiles(GameMode_Color));
	std::shared_ptr<Screen> mode1 = std::shared_ptr<Screen>(new ConnectingTiles(GameMode_Spelling));
	std::shared_ptr<Screen> mode2 = std::shared_ptr<Screen>(new ConnectingTiles(GameMode_Math));
	std::shared_ptr<Screen> mode3 = std::shared_ptr<Screen>(new ConnectingTiles(GameMode_Vocabulary));
	game.setScreen(mode0);

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(mode0);
					break;
				}
				case 1:
				{
					game.setScreen(mode1);
					break;
				}
				case 2:
				{
					game.setScreen(mode2);
					break;
				}
				case 3:
				{
					game.setScreen(mode3);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}