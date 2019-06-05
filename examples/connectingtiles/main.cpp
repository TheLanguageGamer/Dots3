#include "Engine.h"
#include "words2.h"
#include <set>
#include <random>

std::random_device rd;
std::mt19937 rng(rd()); 

enum GameMode
{
	GameMode_Color,
	GameMode_Spelling,
	GameMode_Math,
};

struct Tile : RoundedRectangleComponent
{
	std::shared_ptr<TextComponent> label;

	Tile(std::vector<Entity>& entities, GameMode mode)
	: RoundedRectangleComponent(entities, 5.0, 3.0, 0xFFFFFF00, 0x226699FF)
	{
		if (mode == GameMode_Spelling || mode == GameMode_Math)
		{		
			label = std::shared_ptr<TextComponent>(
				new TextComponent(entities, "A", 0xFFFFFF00, 18.0f));
			label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
			label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
			label->setRelativeSize(entities, Vector2(0.7, 1.0));

			addChild(entities, label);
		}
	}
};

struct Configuration
{
	virtual uint32_t chooseState(uint32_t row, uint32_t column) = 0;
	virtual void didSetState(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell) = 0;
	virtual void willRemoveCell(std::shared_ptr<ComponentCell> cell) = 0;
	virtual void didDeselect(std::shared_ptr<ComponentCell> cell) = 0;
	virtual void didSelect(std::shared_ptr<ComponentCell> cell) = 0;
	virtual bool canSelect(
		std::vector<std::shared_ptr<ComponentCell>> selected,
		std::shared_ptr<ComponentCell> cell) = 0;
	virtual bool shouldAcceptSelected(std::vector<std::shared_ptr<ComponentCell>> selected) = 0;
	virtual void didClearSelected() = 0;
};

struct ColorConfiguration : Configuration
{
	uint32_t chooseState(uint32_t row, uint32_t column)
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
	void didDeselect(std::shared_ptr<ComponentCell> cell)
	{

	}
	void didSelect(std::shared_ptr<ComponentCell> cell)
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
	};
	struct Node
	{
		Type type = Type_Number;
		int32_t value = 0;

		Node(Type type, int32_t value = 0)
		: type(type), value(value) {}

		std::string display() const
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
	uint32_t chooseState(uint32_t row, uint32_t column)
	{
		if (row%2 == 1 && column%2 == 1)
		{
			static std::uniform_int_distribution<int32_t> opDist(1, 2);
			Type type = (Type)opDist(rng);
			Node node(type);
			return Node::toState(node);
		}
		else
		{
			static std::uniform_int_distribution<uint32_t> dist(1, 9);
			int32_t value = dist(rng);
			Node node(Type_Number, value);
			return Node::toState(node);
		}
	}
	void didSetState(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell)
	{
		const Node node = Node::fromState(cell->state);
		auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
		tile->setFillColor(entities, 0x226699FF);
		tile->label->setText(entities, node.display());
	}
	void willRemoveCell(std::shared_ptr<ComponentCell> cell)
	{

	}
	void didDeselect(std::shared_ptr<ComponentCell> cell)
	{

	}
	void didSelect(std::shared_ptr<ComponentCell> cell)
	{

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
		evaluate(selected);
		return true;
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

	uint32_t chooseState(uint32_t row, uint32_t column)
	{
		static const std::string vowels = "AEIOU";
		static const std::string consonants = "BCDFGHJKLMNPQRSTVWXYZ";
		static std::uniform_int_distribution<uint32_t> vowelDist(0, vowels.size()-1);
		static std::uniform_int_distribution<uint32_t> consonantDist(0, consonants.size()-1);
		static std::uniform_real_distribution<> dist(0, 1);
		static const float targetVowelRatio = 0.37;
		float p = dist(rng);
		char c = '\0';
		if (p <= targetVowelRatio)
		{
			c = vowels.at(vowelDist(rng));
		}
		else
		{
			c = consonants.at(consonantDist(rng));
		}
		return c - 'A';
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
	void didDeselect(std::shared_ptr<ComponentCell> cell)
	{
		//assert word.size() > 0
		printf("didDeselect %s\n", word.c_str());
		word.pop_back();
	}
	void didSelect(std::shared_ptr<ComponentCell> cell)
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
	std::vector<std::shared_ptr<ComponentCell>> selected;
	uint32_t selectedState;

	ConnectingTiles(GameMode mode)
	: board(nullptr)
	, selectedState(0)
	, configuration(nullptr)
	, mode(mode)
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
		}

		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

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
				Vector2Int(8, 5),
				0.20,
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
		rootComponent->addChild(entities, background);

		fillErUp();
	}

	void fillErUp()
	{
		static std::uniform_real_distribution<> dist(-500, 500);
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				if (board->grid[row][column])
				{
					continue;
				}
				float offset = dist(rng);
				uint32_t state = configuration->chooseState(row, column);
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
				select(row, column);
				selected.push_back(cell);
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
				configuration->didDeselect(cell);
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
			tile->setStrokeColor(entities, 0xFFFFFFFF);
			if (!cell->selected)
			{
				configuration->didSelect(cell);
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
					deselect(selected[selected.size()-1]->row, selected[selected.size()-1]->column);
					selected.pop_back();
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

				select(row, column);
				selected.push_back(cell);
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
		for (auto cell : selected)
		{
			uint32_t row = cell->row;
			uint32_t column = cell->column;
			deselect(row, column);
		}
		selected.clear();
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
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}